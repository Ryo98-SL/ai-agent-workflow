import { useState } from "react";
import { ChevronDown, Info, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  AGENT_STRATEGIES,
  resolveToolDescriptor,
  toolDescriptorKey,
  type AgentNode,
  type AgentStrategy,
  type AgentToolBinding,
  type JsonValue,
  type ModelProvider,
  type ProviderKeyPreference,
  type WorkflowFile,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";
import { Popover } from "../Popover";
import { VariableRichTextEditor } from "../richtext/VariableRichTextEditor";
import { resolveToolIcon } from "../workflowNodes/workflowNodeVisuals";
import { ToolBrowser } from "../tools/ToolBrowser";
import { ToolParamForm } from "../tools/ToolParamForm";
import { NodeModelSettingField, modelSettingsForEditor, sanitizeNodeModelSettings } from "./sharedModelSettingField";

type AgentInspectorProps = {
  workflow: WorkflowFile;
  node: AgentNode;
  showDevModelProviders?: boolean;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
  onOpenMcpServers?: () => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

const STRATEGY_LABELS: Record<AgentStrategy, string> = {
  functionCalling: "Function Calling",
  react: "ReAct",
};

/**
 * Inspector for an Agent node (ADR 0005): pick a strategy + model, assemble an inline
 * tool list (multi-select Tool Browser, with optional author-fixed params), write the
 * instruction/query, and bound the loop. Mirrors the LLM inspector's model + memory.
 */
export function AgentInspector({
  workflow,
  node,
  showDevModelProviders = false,
  onProviderKeyPreferenceChange,
  onOpenMcpServers,
  updateNode,
}: AgentInspectorProps) {
  const modelSettings = modelSettingsForEditor(workflow, node);
  const hasModelOverride = Boolean(node.config.modelSettings || node.config.model);

  const updateConfig = (patch: Partial<AgentNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "agent" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };
  const setTools = (tools: AgentToolBinding[]) => updateConfig({ tools });

  return (
    <div className="space-y-4">
      <StrategyPicker
        strategy={node.config.strategy}
        onChange={(strategy) => updateConfig({ strategy })}
      />

      <NodeModelSettingField
        hasModelOverride={hasModelOverride}
        modelSettings={modelSettings}
        nodeId={node.id}
        workflow={workflow}
        showDevModelProviders={showDevModelProviders}
        onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
        onChange={(nextSettings) => updateConfig({ model: undefined, modelSettings: sanitizeNodeModelSettings(nextSettings) })}
        onReset={() => updateConfig({ model: undefined, modelSettings: undefined })}
      />

      <AgentToolList nodeId={node.id} tools={node.config.tools} onChange={setTools} onOpenMcpServers={onOpenMcpServers} />

      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Instruction (System)</span>
        <VariableRichTextEditor
          nodeId={node.id}
          ariaLabel="Agent instruction"
          value={node.config.instruction}
          onChange={(instruction) => updateConfig({ instruction })}
          placeholder="设定 Agent 的角色与目标，/ 引用上游变量"
          className="min-h-24"
        />
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Query (User)
          <span className="text-destructive"> *</span>
        </span>
        <VariableRichTextEditor
          nodeId={node.id}
          ariaLabel="Agent query"
          value={node.config.query}
          onChange={(query) => updateConfig({ query })}
          placeholder="本轮用户输入，默认 {{userInput.query}}，/ 引用上游变量"
          className="min-h-16"
        />
        {node.config.query.trim().length === 0 && (
          <span className="mt-1 block text-xs text-destructive">Query 不能为空。</span>
        )}
      </div>

      <MaxIterationsField
        value={node.config.maxIterations}
        onChange={(maxIterations) => updateConfig({ maxIterations })}
      />

      <label className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Conversation memory</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Remember prior turns across runs in the same conversation (multi-turn chat).
          </span>
        </span>
        <input
          type="checkbox"
          checked={node.config.memory ?? false}
          onChange={(event) => updateConfig({ memory: event.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--brand))]"
        />
      </label>

      <NodeOutputVariablesPanel nodeType="agent" />
    </div>
  );
}

function StrategyPicker({ strategy, onChange }: { strategy: AgentStrategy; onChange: (strategy: AgentStrategy) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">Agentic Strategy</span>
      <div className="flex gap-1 rounded-md border border-border bg-muted/40 p-1">
        {AGENT_STRATEGIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              strategy === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {STRATEGY_LABELS[option]}
          </button>
        ))}
      </div>
      {strategy === "react" && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          ReAct 策略暂未实现，运行时会报错。请使用 Function Calling。
        </p>
      )}
    </div>
  );
}

function AgentToolList({
  nodeId,
  tools,
  onChange,
  onOpenMcpServers,
}: {
  nodeId: string;
  tools: AgentToolBinding[];
  onChange: (tools: AgentToolBinding[]) => void;
  onOpenMcpServers?: () => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const selectedKeys = new Set(tools.map((tool) => toolDescriptorKey(tool.provider, tool.providerId, tool.toolName)));

  const toggle = (descriptor: { provider: AgentToolBinding["provider"]; providerId: string; toolName: string }) => {
    const key = toolDescriptorKey(descriptor.provider, descriptor.providerId, descriptor.toolName);
    if (selectedKeys.has(key)) {
      onChange(tools.filter((tool) => toolDescriptorKey(tool.provider, tool.providerId, tool.toolName) !== key));
    } else {
      onChange([...tools, { provider: descriptor.provider, providerId: descriptor.providerId, toolName: descriptor.toolName, params: {} }]);
    }
  };

  const setParams = (key: string, params: Record<string, JsonValue>) =>
    onChange(
      tools.map((tool) =>
        toolDescriptorKey(tool.provider, tool.providerId, tool.toolName) === key ? { ...tool, params } : tool,
      ),
    );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">工具 ({tools.length})</span>
        <Popover
          id={`agent-tools-${nodeId}`}
          open={browsing}
          onOpenChange={setBrowsing}
          placement="bottom-end"
          renderTrigger={({ ref, props }) => (
            <button
              {...props}
              ref={ref}
              type="button"
              onClick={() => setBrowsing((open) => !open)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus size={13} aria-hidden />
              添加工具
            </button>
          )}
        >
          <div className="h-[440px] w-[320px] overflow-hidden rounded-md border border-border bg-card shadow-xl shadow-black/20">
            <ToolBrowser selectedKeys={selectedKeys} onToggle={toggle} onOpenMcpServers={onOpenMcpServers} />
          </div>
        </Popover>
      </div>

      {tools.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          还没有工具。点击「添加工具」从工具浏览器选择内置工具或 MCP 工具。
        </p>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <AgentToolRow
              key={toolDescriptorKey(tool.provider, tool.providerId, tool.toolName)}
              nodeId={nodeId}
              tool={tool}
              onRemove={() => toggle(tool)}
              onParamsChange={(params) => setParams(toolDescriptorKey(tool.provider, tool.providerId, tool.toolName), params)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AgentToolRow({
  nodeId,
  tool,
  onRemove,
  onParamsChange,
}: {
  nodeId: string;
  tool: AgentToolBinding;
  onRemove: () => void;
  onParamsChange: (params: Record<string, JsonValue>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptor = resolveToolDescriptor(tool);
  const Icon = resolveToolIcon(descriptor?.icon);
  const isMcp = tool.provider === "mcp";
  const hasConfigurableParams = !isMcp && (descriptor?.params.length ?? 0) > 0;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
          <Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{descriptor?.label ?? tool.toolName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isMcp ? `MCP · ${tool.providerId}` : `${tool.provider} · ${tool.toolName}`}
          </p>
        </div>
        {hasConfigurableParams && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label="配置参数"
            aria-expanded={expanded}
            className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown size={14} aria-hidden /> : <SlidersHorizontal size={14} aria-hidden />}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="移除工具"
          className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
      {isMcp && (
        <p className="flex items-center gap-1.5 border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
          <Info size={11} className="shrink-0" aria-hidden />
          参数由 Agent 在调用时自动填充。
        </p>
      )}
      {expanded && hasConfigurableParams && descriptor && (
        <div className="space-y-3 border-t border-border p-3">
          <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
            <Info size={11} className="mt-0.5 shrink-0" aria-hidden />
            填写的参数将被固定；留空的参数由 Agent 自动填充。
          </p>
          <ToolParamForm nodeId={nodeId} descriptor={descriptor} params={tool.params} onChange={onParamsChange} />
        </div>
      )}
    </div>
  );
}

function MaxIterationsField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const clamp = (next: number) => Math.min(50, Math.max(1, Math.round(next)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Maximum Iterations</span>
        <span className="text-xs font-semibold text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={50}
        step={1}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        className="w-full accent-[hsl(var(--brand))]"
        aria-label="Maximum iterations"
      />
      <p className="mt-1 text-xs text-muted-foreground">Agent 调用工具的最大轮数（超出会中止）。</p>
    </div>
  );
}
