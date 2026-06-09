import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Button } from "../Button";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";

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
        <div key={branch.id} className="space-y-3 rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {caseIndex === 0 ? "IF" : "ELSE IF"}
            </span>
            {node.config.cases.length > 1 && (
              <button
                type="button"
                aria-label={`Remove ${caseIndex === 0 ? "IF" : "ELSE IF"} branch`}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => updateCases(node.config.cases.filter((_, index) => index !== caseIndex))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>

          {branch.conditions.map((condition, conditionIndex) => (
            <div key={conditionIndex} className="space-y-2 rounded-md border border-border/70 bg-background p-2">
              {conditionIndex > 0 && (
                <CombinatorToggle
                  value={branch.combinator}
                  onChange={(combinator) => patchCase(caseIndex, { combinator })}
                />
              )}
              <Field label="Variable">
                <Input
                  value={condition.variable}
                  onChange={(event) => patchCondition(caseIndex, conditionIndex, { variable: event.target.value })}
                  placeholder="{{llm1.text}}"
                  className="font-mono text-xs"
                />
              </Field>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field label="Operator">
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        patchCondition(caseIndex, conditionIndex, { operator: value as ConditionOperator })
                      }
                    >
                      <SelectTrigger>
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
                  </Field>
                </div>
                {!isValuelessOperator(condition.operator) && (
                  <div className="flex-1">
                    <Field label="Value">
                      <Input
                        value={condition.value}
                        onChange={(event) => patchCondition(caseIndex, conditionIndex, { value: event.target.value })}
                        placeholder="Comparison value"
                      />
                    </Field>
                  </div>
                )}
              </div>
              {branch.conditions.length > 1 && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() =>
                    patchCase(caseIndex, {
                      conditions: branch.conditions.filter((_, index) => index !== conditionIndex),
                    })
                  }
                >
                  <Trash2 size={12} aria-hidden /> Remove condition
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
            onClick={() => patchCase(caseIndex, { conditions: [...branch.conditions, { ...emptyCondition }] })}
          >
            <Plus size={12} aria-hidden /> Add condition
          </button>
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
        <Plus size={14} aria-hidden /> Add ELSE IF branch
      </Button>

      <div className="rounded-md border border-dashed border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ELSE</span>
        <p className="mt-1 text-xs text-muted-foreground">
          Runs when no branch above matches. Connect it to the fallback path.
        </p>
      </div>

      <NodeOutputVariablesPanel nodeType="ifElse" />
    </div>
  );
}

function CombinatorToggle({
  value,
  onChange,
}: {
  value: IfElseCase["combinator"];
  onChange: (value: IfElseCase["combinator"]) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
      {(["and", "or"] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={[
            "px-2 py-0.5 font-medium uppercase transition-colors",
            value === option ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:text-foreground",
          ].join(" ")}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
