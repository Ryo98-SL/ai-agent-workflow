import { resolvePromptWithRuntimeState, type WorkflowRuntimeState } from "./promptVariables";
import {
  IFELSE_ELSE_HANDLE_ID,
  type ConditionOperator,
  type ConditionRow,
  type IfElseCase,
  type IfElseNode,
} from "./schema";

/**
 * Resolve a `{{nodeId.path}}` template against runtime state, leniently: a
 * missing variable yields "" (so `isEmpty` is true and comparisons are
 * deterministic) instead of throwing. Literal text passes through unchanged.
 */
function resolveOperand(template: string, state: WorkflowRuntimeState): string {
  if (!template) {
    return "";
  }
  const resolution = resolvePromptWithRuntimeState(template, state);
  return resolution.ok ? resolution.text : "";
}

function compareNumbers(left: string, right: string, compare: (a: number, b: number) => boolean): boolean {
  const a = Number(left);
  const b = Number(right);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return false;
  }
  return compare(a, b);
}

function evaluateCondition(condition: ConditionRow, state: WorkflowRuntimeState): boolean {
  const left = resolveOperand(condition.variable, state);
  const right = resolveOperand(condition.value, state);
  const operator: ConditionOperator = condition.operator;

  switch (operator) {
    case "equals":
      return left === right;
    case "notEquals":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "notContains":
      return !left.includes(right);
    case "isEmpty":
      return left.trim() === "";
    case "isNotEmpty":
      return left.trim() !== "";
    case "gt":
      return compareNumbers(left, right, (a, b) => a > b);
    case "gte":
      return compareNumbers(left, right, (a, b) => a >= b);
    case "lt":
      return compareNumbers(left, right, (a, b) => a < b);
    case "lte":
      return compareNumbers(left, right, (a, b) => a <= b);
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

/**
 * A case matches when its (non-empty) condition rows all pass (`and`) or any
 * passes (`or`). A case with no conditions never matches — it cannot become an
 * accidental catch-all; the implicit `else` handles fallthrough.
 */
export function caseMatches(branch: IfElseCase, state: WorkflowRuntimeState): boolean {
  if (branch.conditions.length === 0) {
    return false;
  }
  return branch.combinator === "or"
    ? branch.conditions.some((condition) => evaluateCondition(condition, state))
    : branch.conditions.every((condition) => evaluateCondition(condition, state));
}

/**
 * Returns the source-handle id of the first matching case, or
 * `IFELSE_ELSE_HANDLE_ID` when none match.
 */
export function evaluateIfElseNode(node: IfElseNode, state: WorkflowRuntimeState): string {
  for (const branch of node.config.cases) {
    if (caseMatches(branch, state)) {
      return branch.id;
    }
  }
  return IFELSE_ELSE_HANDLE_ID;
}
