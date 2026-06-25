import { useState } from "react";
import { Repeat } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import {
  resolveToolDescriptor,
  type JsonValue,
  type ToolDescriptor,
  type ToolNode,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";
import { Popover } from "../Popover";
import { resolveToolIcon } from "../workflowNodes/workflowNodeVisuals";
import { ToolBrowser } from "../tools/ToolBrowser";
import { EmailSendControl } from "../tools/EmailSendControl";
import { ToolParamForm } from "../tools/ToolParamForm";

type ToolInspectorProps = {
  node: ToolNode;
  onOpenMcpServers?: () => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

/**
 * Inspector for a Tool node (ADR 0003). The bound tool's identity is fixed once
 * chosen (no adapter dropdown); the form is generated from the descriptor's
 * param-spec, and "更换工具" reopens the Tool Browser to rebind in place.
 */
export function ToolInspector({ node, onOpenMcpServers, updateNode }: ToolInspectorProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const [browsing, setBrowsing] = useState(false);
  const descriptor = resolveToolDescriptor(node.config);
  const isEmail = descriptor?.provider === "builtin" && descriptor.toolName === "emailSend";
  const formDescriptor = isEmail
    ? { ...descriptor, params: descriptor.params.filter((param) => param.name !== "send") }
    : descriptor;
  const Icon = resolveToolIcon(descriptor?.icon);
  const boundKey = descriptor
    ? `${descriptor.provider}:${descriptor.providerId}:${descriptor.toolName}`
    : undefined;

  const setParams = (params: Record<string, JsonValue>) => {
    updateNode(node.id, (current) =>
      current.type === "tool" ? { ...current, config: { ...current.config, params } } : current,
    );
  };

  const rebind = (next: ToolDescriptor) => {
    updateNode(node.id, (current) =>
      current.type === "tool"
        ? {
            ...current,
            // Keep a custom label; refresh it only when it still matches the old tool's default.
            label: current.label === descriptor?.label ? next.label : current.label,
            config: {
              provider: next.provider,
              providerId: next.providerId,
              toolName: next.toolName,
              params: structuredClone(next.defaultParams),
            },
          }
        : current,
    );
    setBrowsing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-card p-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {descriptor?.label ?? t("inspectors.tool.unknown", { defaultValue: "Unknown tool" })}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {node.config.provider} · {node.config.toolName}
          </p>
        </div>
        <Popover
          id={`tool-rebind-${node.id}`}
          open={browsing}
          onOpenChange={setBrowsing}
          placement="bottom-end"
          renderTrigger={({ ref, props }) => (
            <button
              {...props}
              ref={ref}
              type="button"
              onClick={() => setBrowsing((open) => !open)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Repeat size={13} aria-hidden />
              {t("inspectors.tool.change", { defaultValue: "Change tool" })}
            </button>
          )}
        >
          <div className="h-[440px] w-[320px] overflow-hidden rounded-md border border-border bg-card shadow-xl shadow-black/20">
            <ToolBrowser selectedKey={boundKey} onSelect={rebind} onOpenMcpServers={onOpenMcpServers} />
          </div>
        </Popover>
      </div>

      {formDescriptor ? (
        <>
          <ToolParamForm nodeId={node.id} descriptor={formDescriptor} params={node.config.params} onChange={setParams} />
          {isEmail && (
            <EmailSendControl
              enabled={node.config.params.send === true}
              onChange={(send) => setParams({ ...node.config.params, send })}
            />
          )}
        </>
      ) : (
        <p className="rounded-md bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
          {t("inspectors.tool.unavailable", {
            defaultValue: "This node's bound tool is unavailable. Click \"Change tool\" to choose another one.",
          })}
        </p>
      )}

      <NodeOutputVariablesPanel node={node} />
    </div>
  );
}
