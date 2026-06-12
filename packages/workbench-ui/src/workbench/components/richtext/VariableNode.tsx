import type { ReactNode } from "react";
import {
  $applyNodeReplacement,
  DecoratorNode,
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
    return <VariableTag reference={this.__reference} />;
  }

  static importJSON(serialized: SerializedVariableNode): VariableNode {
    return $createVariableNode(serialized.reference);
  }

  exportJSON(): SerializedVariableNode {
    return { type: "variable", version: 1, reference: this.__reference };
  }
}

export function $createVariableNode(reference: string): VariableNode {
  return $applyNodeReplacement(new VariableNode(reference));
}

export function $isVariableNode(node: LexicalNode | null | undefined): node is VariableNode {
  return node instanceof VariableNode;
}
