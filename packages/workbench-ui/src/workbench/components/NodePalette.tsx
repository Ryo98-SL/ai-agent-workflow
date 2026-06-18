import { useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { Bot, Brain, Braces, Database, Flag, GitBranch, Play, TextCursorInput, UserCheck, Wrench, type LucideIcon } from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import type { ToolIdentity } from "../types";
import { Button } from "./Button";
import { ToolBrowser } from "./tools/ToolBrowser";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodes/workflowNodeVisuals";

type PaletteItem = {
  type: WorkflowNodeType;
  labelKey: string;
  descriptionKey: string;
  groupKey: string;
  icon: LucideIcon;
};

const items: PaletteItem[] = [
  { type: "start", labelKey: "nodePalette.items.start.label", descriptionKey: "nodePalette.items.start.description", groupKey: "nodePalette.groups.basic", icon: Play },
  { type: "end", labelKey: "nodePalette.items.end.label", descriptionKey: "nodePalette.items.end.description", groupKey: "nodePalette.groups.basic", icon: Flag },
  { type: "llm", labelKey: "nodePalette.items.llm.label", descriptionKey: "nodePalette.items.llm.description", groupKey: "nodePalette.groups.ai", icon: Brain },
  { type: "agent", labelKey: "nodePalette.items.agent.label", descriptionKey: "nodePalette.items.agent.description", groupKey: "nodePalette.groups.ai", icon: Bot },
  { type: "knowledge", labelKey: "nodePalette.items.knowledge.label", descriptionKey: "nodePalette.items.knowledge.description", groupKey: "nodePalette.groups.ai", icon: Database },
  { type: "tool", labelKey: "nodePalette.items.tool.label", descriptionKey: "nodePalette.items.tool.description", groupKey: "nodePalette.groups.tools", icon: Wrench },
  { type: "code", labelKey: "nodePalette.items.code.label", descriptionKey: "nodePalette.items.code.description", groupKey: "nodePalette.groups.tools", icon: Braces },
  { type: "ifElse", labelKey: "nodePalette.items.ifElse.label", descriptionKey: "nodePalette.items.ifElse.description", groupKey: "nodePalette.groups.logic", icon: GitBranch },
  { type: "humanInput", labelKey: "nodePalette.items.humanInput.label", descriptionKey: "nodePalette.items.humanInput.description", groupKey: "nodePalette.groups.logic", icon: UserCheck },
  { type: "template", labelKey: "nodePalette.items.template.label", descriptionKey: "nodePalette.items.template.description", groupKey: "nodePalette.groups.logic", icon: TextCursorInput },
];

export function NodePalette({
  disabledTypes = [],
  hasStartNode,
  onAddNode,
}: {
  disabledTypes?: WorkflowNodeType[];
  hasStartNode: boolean;
  onAddNode: (type: WorkflowNodeType, tool?: ToolIdentity) => void;
}) {
  const { t } = useTranslation("workbench");
  const groups = [...new Set(items.map((item) => item.groupKey))];
  const disabledTypeSet = new Set(disabledTypes);
  // Picking "Tool" drills into the Tool Browser to choose a specific tool, which
  // is what actually binds and inserts the node.
  const [browsingTools, setBrowsingTools] = useState(false);

  if (browsingTools) {
    return (
      <ToolBrowser
        onBack={() => setBrowsingTools(false)}
        onSelect={(descriptor) => {
          onAddNode("tool", {
            provider: descriptor.provider,
            providerId: descriptor.providerId,
            toolName: descriptor.toolName,
          });
          setBrowsingTools(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => (
          <section key={group} className="mb-5">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(group)}</h3>
            <div className="space-y-2">
              {items
                .filter((item) => item.groupKey === group)
                .map((item) => {
                  const disabled = (item.type === "start" && hasStartNode) || disabledTypeSet.has(item.type);
                  const label = t(item.labelKey);
                  return (
                    <Button
                      key={item.type}
                      variant="nodePalette"
                      size="unstyled"
                      fullWidth
                      disabled={disabled}
                      onClick={() => (item.type === "tool" ? setBrowsingTools(true) : onAddNode(item.type))}
                      title={disabled ? disabledPaletteItemTitle(item.type, hasStartNode, t) : label}
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
                        <span className="block truncate text-sm font-medium">{label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t(item.descriptionKey)}</span>
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

function disabledPaletteItemTitle(type: WorkflowNodeType, hasStartNode: boolean, t: (key: string) => string) {
  if (type === "start" && hasStartNode) {
    return t("nodePalette.disabledStart");
  }

  if (type === "end") {
    return t("nodePalette.disabledEnd");
  }

  return t("nodePalette.disabledUnavailable");
}
