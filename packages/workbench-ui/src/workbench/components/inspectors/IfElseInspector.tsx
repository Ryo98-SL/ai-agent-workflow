import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import {
  CONDITION_OPERATORS,
  conditionOperatorLabel,
  IFELSE_ELSE_HANDLE_ID,
  isValuelessOperator,
  type ConditionOperator,
  type ConditionRow,
  type IfElseCase,
  type IfElseNode,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workbench/components/ui/select";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { Button } from "../Button";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";
import { VariablePickerButton } from "../VariablePickerButton";

type IfElseInspectorProps = {
  node: IfElseNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

function nextCaseId(cases: IfElseCase[]): string {
  const used = new Set(cases.map((branch) => branch.id));
  let index = cases.length + 1;
  while (used.has(`case-${index}`) || `case-${index}` === IFELSE_ELSE_HANDLE_ID) {
    index += 1;
  }
  return `case-${index}`;
}

const emptyCondition: ConditionRow = { variable: "", operator: "equals", value: "" };

export function IfElseInspector({ node, updateNode }: IfElseInspectorProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const updateCases = (cases: IfElseCase[]) => {
    updateNode(node.id, (current) =>
      current.type === "ifElse" ? { ...current, config: { ...current.config, cases } } : current,
    );
  };

  const patchCase = (caseIndex: number, patch: Partial<IfElseCase>) => {
    updateCases(node.config.cases.map((branch, index) => (index === caseIndex ? { ...branch, ...patch } : branch)));
  };

  const patchCondition = (caseIndex: number, conditionIndex: number, patch: Partial<ConditionRow>) => {
    patchCase(caseIndex, {
      conditions: node.config.cases[caseIndex].conditions.map((condition, index) =>
        index === conditionIndex ? { ...condition, ...patch } : condition,
      ),
    });
  };

  return (
    <div className="space-y-4">
      {node.config.cases.map((branch, caseIndex) => (
        <div key={branch.id} className="space-y-3 rounded-md border border-border bg-card p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {caseIndex === 0
                ? t("inspectors.ifElse.ifBranch", { defaultValue: "IF" })
                : t("inspectors.ifElse.elseIfBranch", { defaultValue: "ELSE IF" })}
            </span>
            {node.config.cases.length > 1 && (
              <button
                type="button"
                aria-label={t("inspectors.ifElse.removeBranch", {
                  defaultValue: "Remove {{branch}} branch",
                  branch:
                    caseIndex === 0
                      ? t("inspectors.ifElse.ifBranch", { defaultValue: "IF" })
                      : t("inspectors.ifElse.elseIfBranch", { defaultValue: "ELSE IF" }),
                })}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => updateCases(node.config.cases.filter((_, index) => index !== caseIndex))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {/* AND/OR connector spanning the condition group */}
            {branch.conditions.length > 1 && (
              <div className="relative flex w-7 shrink-0 justify-center">
                <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-border" aria-hidden />
                <button
                  type="button"
                  onClick={() => patchCase(caseIndex, { combinator: branch.combinator === "and" ? "or" : "and" })}
                  className="relative z-10 my-auto flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                  title={t("inspectors.ifElse.toggleAndOr", { defaultValue: "Toggle AND / OR" })}
                >
                  {branch.combinator}
                  <RefreshCw size={10} aria-hidden />
                </button>
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              {branch.conditions.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                  {t("inspectors.ifElse.emptyConditions", {
                    defaultValue: "No conditions yet — this branch never matches until you add one.",
                  })}
                </p>
              ) : (
                branch.conditions.map((condition, conditionIndex) => (
                  <div key={conditionIndex} className="space-y-1.5 rounded-md border border-border bg-background p-1.5">
                    {/* Variable on its own full-width row so the node-variable tag
                        is never squeezed by the operator. */}
                    <div className="flex items-center gap-1">
                      <VariablePickerButton
                        nodeId={node.id}
                        value={condition.variable}
                        onChange={(reference) => patchCondition(caseIndex, conditionIndex, { variable: reference })}
                      />
                      <button
                        type="button"
                        aria-label={t("inspectors.ifElse.removeCondition", { defaultValue: "Remove condition" })}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          patchCase(caseIndex, {
                            conditions: branch.conditions.filter((_, index) => index !== conditionIndex),
                          })
                        }
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                    {/* Operator + comparison value share the next row. */}
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          patchCondition(caseIndex, conditionIndex, { operator: value as ConditionOperator })
                        }
                      >
                        <SelectTrigger className="w-36 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map((operator) => (
                            <SelectItem key={operator} value={operator}>
                              {conditionOperatorLabel(operator)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isValuelessOperator(condition.operator) && (
                        <Input
                          value={condition.value}
                          onChange={(event) => patchCondition(caseIndex, conditionIndex, { value: event.target.value })}
                          placeholder={t("inspectors.ifElse.comparisonValue", { defaultValue: "Comparison value" })}
                          className="min-w-0 flex-1"
                        />
                      )}
                    </div>
                  </div>
                ))
              )}

              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
                onClick={() => patchCase(caseIndex, { conditions: [...branch.conditions, { ...emptyCondition }] })}
              >
                <Plus size={12} aria-hidden /> {t("inspectors.ifElse.addCondition", { defaultValue: "Add condition" })}
              </button>
            </div>
          </div>
        </div>
      ))}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
          updateCases([
            ...node.config.cases,
            { id: nextCaseId(node.config.cases), combinator: "and", conditions: [{ ...emptyCondition }] },
          ])
        }
      >
        <Plus size={14} aria-hidden /> {t("inspectors.ifElse.addElseIf", { defaultValue: "Add ELSE IF branch" })}
      </Button>

      <div className="rounded-md border border-dashed border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("inspectors.ifElse.elseBranch", { defaultValue: "ELSE" })}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("inspectors.ifElse.elseDescription", {
            defaultValue: "Runs when no branch above matches. Connect it to the fallback path.",
          })}
        </p>
      </div>

      <NodeOutputVariablesPanel nodeType="ifElse" />
    </div>
  );
}
