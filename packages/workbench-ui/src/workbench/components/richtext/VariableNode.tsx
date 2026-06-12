import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { VariableTag } from "../VariableTag";

export type SerializedVariableNode = Spread<{ reference: string }, SerializedLexicalNode>;

/**
 * Atomic, inline Lexical node for a single Variable Reference. It stores the
 * canonical `{{nodeId.path}}` string and renders the shared `VariableTag` (node
 * icon + label + variable name). Overriding `getTextContent` to return the
 * reference is what makes `root.getTextContent()` serialize the editor back to
 * the canonical template string — chips become `{{...}}`, line breaks become
 * `\n`, plain runs stay as-is.
 */
export class VariableNode extends DecoratorNode<ReactNode> {
  __reference: string;

  static getType(): string {
    return "variable";
  }

  static clone(node: VariableNode): VariableNode {
    return new VariableNode(node.__reference, node.__key);
  }

  constructor(reference: string, key?: NodeKey) {
    super(key);
    this.__reference = reference;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    span.style.userSelect = "none";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  /** Serialized form — drives `root.getTextContent()` and clipboard text. */
  getTextContent(): string {
    return this.__reference;
  }

  getReference(): string {
    return this.__reference;
  }

  decorate(): ReactNode {
    return <VariableChip nodeKey={this.getKey()} reference={this.__reference} />;
  }

  static importJSON(serialized: SerializedVariableNode): VariableNode {
    return $createVariableNode(serialized.reference);
  }

  exportJSON(): SerializedVariableNode {
    return { type: "variable", version: 1, reference: this.__reference };
  }
}

/**
 * Renders a Variable chip that can be selected as one atomic unit. A
 * `DecoratorNode` has no internal caret positions, so without explicit node
 * selection a click would only place the caret beside it and the chip could
 * never be highlighted or deleted as a whole. We claim the click for this node,
 * reflect the selected state as a ring on the tag, and remove the node on
 * Backspace/Delete while it's selected.
 */
function VariableChip({ nodeKey, reference }: { nodeKey: NodeKey; reference: string }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const ref = useRef<HTMLSpanElement>(null);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      const selection = $getSelection();
      if (!isSelected || !$isNodeSelection(selection)) {
        return false;
      }
      event.preventDefault();
      $getNodeByKey(nodeKey)?.remove();
      return true;
    },
    [isSelected, nodeKey],
  );

  useEffect(() => {
    const unregister = [
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        (event) => {
          const target = event.target as Node | null;
          if (ref.current && target && ref.current.contains(target)) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(!isSelected);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
    ];
    return () => unregister.forEach((fn) => fn());
  }, [editor, isSelected, clearSelection, setSelected, onDelete]);

  return (
    <span ref={ref} className="inline-flex align-middle">
      <VariableTag reference={reference} selected={isSelected} />
    </span>
  );
}

export function $createVariableNode(reference: string): VariableNode {
  return $applyNodeReplacement(new VariableNode(reference));
}

export function $isVariableNode(node: LexicalNode | null | undefined): node is VariableNode {
  return node instanceof VariableNode;
}
