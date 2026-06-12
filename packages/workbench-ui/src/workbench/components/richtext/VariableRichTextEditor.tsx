import { useEffect, useId, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createLineBreakNode,
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  type EditorState,
  type LexicalNode,
} from "lexical";
import { parseVariableReference } from "@ai-agent-workflow/workflow-domain";
import { VariableNode, $createVariableNode, $isVariableNode } from "./VariableNode";
import { $populateFromString, $serializeToString, CARET_ANCHOR_CHAR } from "./variableSerialization";
import { SlashVariablePlugin } from "./SlashVariablePlugin";

type VariableRichTextEditorProps = {
  /** Consumer node id — scopes the `/` typeahead to its Available Variables. */
  nodeId: string;
  /** Canonical template string (`...{{nodeId.path}}...`). */
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Controlled rich-text editor for variable-bearing fields. Renders `{{nodeId.path}}`
 * tokens as atomic Variable chips, supports `/` to insert a chip from the upstream
 * variable list, and serializes back to the canonical template string on every
 * change. The string remains the single source of truth (see ADR 0001).
 */
export function VariableRichTextEditor({
  nodeId,
  value,
  onChange,
  multiline = true,
  placeholder,
  className,
  ariaLabel,
}: VariableRichTextEditorProps) {
  const namespace = useId();

  return (
    <LexicalComposer
      initialConfig={{
        namespace,
        nodes: [VariableNode],
        editorState: () => $populateFromString(value, { multiline }),
        onError: (error) => {
          // Never let an editor error take down the inspector.
          console.error("[VariableRichTextEditor]", error);
        },
        theme: { paragraph: "m-0" },
      }}
    >
      <div
        className={[
          "relative rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 focus-within:ring-1 focus-within:ring-ring",
          className ?? "",
        ].join(" ")}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={ariaLabel}
              className="min-h-[1.25rem] whitespace-pre-wrap break-words outline-none [&_*]:align-middle"
            />
          }
          placeholder={
            <div className="pointer-events-none absolute left-3 top-2 text-muted-foreground/60">{placeholder}</div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <CaretSkipPlugin />
        <SlashVariablePlugin nodeId={nodeId} />
        <ValueSyncPlugin value={value} multiline={multiline} onChange={onChange} />
        <SingleLinePlugin enabled={!multiline} />
        <PlainPastePlugin multiline={multiline} />
      </div>
    </LexicalComposer>
  );
}

/**
 * Two-way sync between the controlled `value` string and the editor. Guards
 * against echo loops (don't re-parse our own serialized output) and against
 * firing `onChange` mid-IME-composition (which would rebuild the editor and
 * break Chinese input).
 */
function ValueSyncPlugin({
  value,
  multiline,
  onChange,
}: {
  value: string;
  multiline: boolean;
  onChange: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastSerialized = useRef<string>(value);

  // External value -> editor (skip when it matches what we last emitted).
  useEffect(() => {
    if (value === lastSerialized.current) {
      return;
    }
    lastSerialized.current = value;
    editor.update(
      () => {
        $populateFromString(value, { multiline });
      },
      { tag: "external-sync" },
    );
  }, [value, multiline, editor]);

  // Editor -> external (skip our own external updates and active composition).
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }: { editorState: EditorState; tags: Set<string> }) => {
      if (tags.has("external-sync") || editor.isComposing()) {
        return;
      }
      editorState.read(() => {
        const next = $serializeToString();
        if (next !== lastSerialized.current) {
          lastSerialized.current = next;
          onChange(next);
        }
      });
    });
  }, [editor, onChange]);

  return null;
}

/**
 * Lands a collapsed caret immediately beside `chip` on the side we're moving
 * toward. A caret only renders when it is anchored to a text node — an element
 * point next to an inline chip (e.g. at the start of a line or the editor) has
 * an empty client rect, so the browser draws nothing and the caret seems stuck.
 * We anchor to the adjacent text node, inserting a zero-width-space sentinel
 * when the chip sits at a boundary with no text neighbor. The sentinel is an
 * invisible but layout-bearing caret slot; `$serializeToString` strips it, so
 * it never leaks into the canonical template, and at most one exists per
 * boundary (the next traversal reuses it as a real text neighbor).
 */
function $landCaretBeside(chip: LexicalNode, isBackward: boolean): void {
  if (isBackward) {
    const previous = chip.getPreviousSibling();
    if ($isTextNode(previous)) {
      const end = previous.getTextContentSize();
      previous.select(end, end);
      return;
    }
    const anchor = $createTextNode(CARET_ANCHOR_CHAR);
    chip.insertBefore(anchor);
    anchor.select(1, 1);
    return;
  }
  const next = chip.getNextSibling();
  if ($isTextNode(next)) {
    next.select(0, 0);
    return;
  }
  const anchor = $createTextNode(CARET_ANCHOR_CHAR);
  chip.insertAfter(anchor);
  anchor.select(0, 0);
}

/**
 * Variable chips are atomic inline `DecoratorNode`s with `user-select: none`, so
 * the browser has no caret position inside them — arrow-keying across one would
 * drop the caret. This intercepts Left/Right at a chip boundary and lands the
 * caret on the far side of the chip in a single press.
 */
function CaretSkipPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const handle = (isBackward: boolean) => (event: KeyboardEvent): boolean => {
      // Leave selection-extension and word/line jumps to the default behavior.
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
        return false;
      }
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return false;
      }
      const anchor = selection.anchor;
      const node = anchor.getNode();
      let chip: LexicalNode | null = null;
      if ($isTextNode(node)) {
        const atEdge = isBackward ? anchor.offset === 0 : anchor.offset === node.getTextContentSize();
        if (!atEdge) {
          return false;
        }
        chip = isBackward ? node.getPreviousSibling() : node.getNextSibling();
      } else {
        // Element anchor: offset indexes the child the caret sits before.
        chip = node.getChildAtIndex(isBackward ? anchor.offset - 1 : anchor.offset);
      }
      if (!$isVariableNode(chip)) {
        return false;
      }
      $landCaretBeside(chip, isBackward);
      event.preventDefault();
      return true;
    };
    const unregisterLeft = editor.registerCommand(KEY_ARROW_LEFT_COMMAND, handle(true), COMMAND_PRIORITY_LOW);
    const unregisterRight = editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, handle(false), COMMAND_PRIORITY_LOW);
    return () => {
      unregisterLeft();
      unregisterRight();
    };
  }, [editor]);
  return null;
}

/** Swallows Enter in single-line fields so they never gain newlines. */
function SingleLinePlugin({ enabled }: { enabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return editor.registerCommand(KEY_ENTER_COMMAND, () => true, COMMAND_PRIORITY_LOW);
  }, [editor, enabled]);
  return null;
}

/**
 * Forces paste to plain text (no foreign HTML formatting) and re-tokenizes any
 * pasted `{{nodeId.path}}` into chips. Single-line fields flatten newlines.
 */
function PlainPastePlugin({ multiline }: { multiline: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text == null) {
          return false;
        }
        event.preventDefault();
        editor.update(() => {
          const cleaned = multiline ? text : text.replace(/\s*\n\s*/g, " ");
          $insertNodes(nodesForPastedText(cleaned, multiline));
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, multiline]);
  return null;
}

const PASTE_TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Inline nodes for pasted text: chips for valid references, text + breaks otherwise. */
function nodesForPastedText(text: string, multiline: boolean): LexicalNode[] {
  const out: LexicalNode[] = [];
  const pushText = (chunk: string) => {
    if (!chunk) {
      return;
    }
    if (!multiline) {
      out.push($createTextNode(chunk));
      return;
    }
    chunk.split("\n").forEach((segment, index) => {
      if (index > 0) {
        out.push($createLineBreakNode());
      }
      if (segment) {
        out.push($createTextNode(segment));
      }
    });
  };

  let lastIndex = 0;
  for (const match of text.matchAll(PASTE_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      pushText(text.slice(lastIndex, index));
    }
    const inner = match[1].trim();
    if (parseVariableReference(inner).ok) {
      out.push($createVariableNode(`{{${inner}}}`));
    } else {
      pushText(match[0]);
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex));
  }
  return out;
}
