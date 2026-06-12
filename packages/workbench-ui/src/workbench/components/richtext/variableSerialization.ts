import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type RootNode,
} from "lexical";
import { parseVariableReference } from "@ai-agent-workflow/workflow-domain";
import { $createVariableNode } from "./VariableNode";

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Zero-width space used as an invisible caret anchor beside a boundary chip
 * (see `$landCaretBeside`). It is stripped from every serialized value so it
 * never appears in the canonical `{{nodeId.path}}` template.
 */
export const CARET_ANCHOR_CHAR = "​";

/**
 * Rebuilds the editor content from a canonical template string. Well-formed
 * `{{nodeId.path}}` tokens become atomic VariableNodes; malformed `{{...}}` and
 * everything else stays literal text (per the round-trip contract). Newlines
 * become LineBreakNodes inside a single paragraph so `getTextContent()` emits
 * `\n` (not paragraph `\n\n`). In single-line mode newlines are collapsed.
 */
export function $populateFromString(value: string, options: { multiline: boolean }): void {
  const root: RootNode = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();

  const appendText = (text: string) => {
    if (!text) {
      return;
    }
    if (!options.multiline) {
      paragraph.append($createTextNode(text.replace(/\s*\n\s*/g, " ")));
      return;
    }
    const segments = text.split("\n");
    segments.forEach((segment, index) => {
      if (index > 0) {
        paragraph.append($createLineBreakNode());
      }
      if (segment) {
        paragraph.append($createTextNode(segment));
      }
    });
  };

  let lastIndex = 0;
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      appendText(value.slice(lastIndex, index));
    }
    const inner = match[1].trim();
    if (parseVariableReference(inner).ok) {
      paragraph.append($createVariableNode(`{{${inner}}}`));
    } else {
      // Not a valid reference — keep the literal braces as plain text.
      appendText(match[0]);
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < value.length) {
    appendText(value.slice(lastIndex));
  }

  root.append(paragraph);
}

/** Serializes the current editor content back to the canonical template string. */
export function $serializeToString(): string {
  return $getRoot().getTextContent().split(CARET_ANCHOR_CHAR).join("");
}
