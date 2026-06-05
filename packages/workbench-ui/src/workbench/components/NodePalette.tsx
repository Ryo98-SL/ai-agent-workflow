import { Brain, Braces, Clock, Database, Flag, GitBranch, Play, TextCursorInput, type LucideIcon } from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { Button } from "./Button";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodes/workflowNodeVisuals";

type PaletteItem = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  group: string;
  icon: LucideIcon;
};

const items: PaletteItem[] = [
  { type: "start", label: "Start", description: "Graph entry marker", group: "Basic", icon: Play },
  { type: "end", label: "End", description: "Graph exit marker", group: "Basic", icon: Flag },
  { type: "llm", label: "LLM", description: "Executable chat debug node", group: "AI", icon: Brain },
  { type: "knowledge", label: "Knowledge", description: "Schema placeholder", group: "AI", icon: Database },
  { type: "tool", label: "Current Time", description: "Executable built-in tool", group: "Tools", icon: Clock },
  { type: "code", label: "Code", description: "Future runtime", group: "Tools", icon: Braces },
  { type: "ifElse", label: "If/Else", description: "Future branching", group: "Logic", icon: GitBranch },
  { type: "template", label: "Template", description: "Future text transform", group: "Logic", icon: TextCursorInput },
];

export function NodePalette({
  disabledTypes = [],
  hasStartNode,
  onAddNode,
}: {
  disabledTypes?: WorkflowNodeType[];
  hasStartNode: boolean;
  onAddNode: (type: WorkflowNodeType) => void;
}) {
  const groups = [...new Set(items.map((item) => item.group))];
  const disabledTypeSet = new Set(disabledTypes);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => (
          <section key={group} className="mb-5">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
            <div className="space-y-2">
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const disabled = (item.type === "start" && hasStartNode) || disabledTypeSet.has(item.type);
                  return (
                    <Button
                      key={item.type}
                      variant="nodePalette"
                      size="unstyled"
                      fullWidth
                      disabled={disabled}
                      onClick={() => onAddNode(item.type)}
                      title={disabled ? disabledPaletteItemTitle(item.type, hasStartNode) : item.label}
                    >
                      <span
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                          workflowNodeIconBackgroundClassNames[item.type],
                          workflowNodeIconClassName,
                        ].join(" ")}
                      >
                        <item.icon size={17} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </Button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function disabledPaletteItemTitle(type: WorkflowNodeType, hasStartNode: boolean) {
  if (type === "start" && hasStartNode) {
    return "This workflow already has a Start node.";
  }

  if (type === "end") {
    return "End nodes cannot feed into this target handle.";
  }

  return "This node type is unavailable here.";
}
