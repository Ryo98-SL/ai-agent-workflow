import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import type {
  LLMNode,
  ModelProvider,
  PromptMessage,
  PromptMessageRole,
  ProviderKeyPreference,
  WorkflowFile,
  WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import { Button } from "../Button";
import { VariableRichTextEditor } from "../richtext/VariableRichTextEditor";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";
import { Popover } from "../Popover";
import { NodeModelSettingField, modelSettingsForEditor, sanitizeNodeModelSettings } from "./sharedModelSettingField";

type LLMInspectorProps = {
  workflow: WorkflowFile;
  node: LLMNode;
  showDevModelProviders?: boolean;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function LLMInspector({
  workflow,
  node,
  showDevModelProviders = false,
  onProviderKeyPreferenceChange,
  updateNode,
}: LLMInspectorProps) {
  const modelSettings = modelSettingsForEditor(workflow, node);
  const hasModelOverride = Boolean(node.config.modelSettings || node.config.model);

  const updateConfig = (patch: Partial<LLMNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "llm" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <NodeModelSettingField
        hasModelOverride={hasModelOverride}
        modelSettings={modelSettings}
        nodeId={node.id}
        workflow={workflow}
        showDevModelProviders={showDevModelProviders}
        onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
        onChange={(nextSettings) =>
          updateConfig({
            model: undefined,
            modelSettings: sanitizeNodeModelSettings(nextSettings),
          })
        }
        onReset={() => updateConfig({ model: undefined, modelSettings: undefined })}
      />
      <PromptMessagesEditor
        nodeId={node.id}
        messages={node.config.messages}
        onChange={(messages) => updateConfig({ messages })}
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
      <NodeOutputVariablesPanel nodeType="llm" />
    </div>
  );
}

const ROLE_LABELS: Record<PromptMessageRole, string> = {
  system: "SYSTEM",
  user: "USER",
  assistant: "ASSISTANT",
};

/** Roles a non-first message can switch between — the pinned first message owns `system`. */
const SELECTABLE_ROLES: PromptMessageRole[] = ["user", "assistant"];

/**
 * Dify-style variable-length prompt editor. The first message is pinned to the
 * `system` role (every LLM call keeps one system prompt); every later message
 * exposes a role selector (system / user / assistant) and can be removed. New
 * messages default to the `user` role.
 */
function PromptMessagesEditor({
  nodeId,
  messages,
  onChange,
}: {
  nodeId: string;
  messages: PromptMessage[];
  onChange: (messages: PromptMessage[]) => void;
}) {
  const updateAt = (index: number, patch: Partial<PromptMessage>) =>
    onChange(messages.map((message, i) => (i === index ? { ...message, ...patch } : message)));
  const removeAt = (index: number) => onChange(messages.filter((_, i) => i !== index));
  const addMessage = () => onChange([...messages, { role: "user", content: "" }]);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {messages.map((message, index) => {
          const pinned = index === 0;
          return (
            <div key={index} className="rounded-md border border-border bg-card">
              <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
                {pinned ? (
                  <span className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                    {ROLE_LABELS.system}
                  </span>
                ) : (
                  <MessageRoleSelect
                    id={`llm-msg-role-${nodeId}-${index}`}
                    role={message.role}
                    onRoleChange={(role) => updateAt(index, { role })}
                  />
                )}
                {!pinned && (
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label="Remove message"
                    className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <VariableRichTextEditor
                nodeId={nodeId}
                ariaLabel={`${ROLE_LABELS[message.role]} prompt`}
                value={message.content}
                onChange={(content) => updateAt(index, { content })}
                placeholder={pinned ? "输入系统提示词，/ 引用上游变量" : "输入 / 引用上游变量"}
                className="!border-0 min-h-20 !rounded-none !rounded-b-md focus-within:!ring-0"
              />
            </div>
          );
        })}
      </div>
      <Button variant="secondary" size="md" fullWidth className="justify-center gap-1.5" onClick={addMessage}>
        <Plus className="size-4" />
        Add Message
      </Button>
    </div>
  );
}

function MessageRoleSelect({
  id,
  role,
  onRoleChange,
}: {
  id: string;
  role: PromptMessageRole;
  onRoleChange: (role: PromptMessageRole) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      id={id}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="Change message role"
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-muted"
        >
          {ROLE_LABELS[role]}
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      )}
    >
      <div className="w-32 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg shadow-black/20">
        {SELECTABLE_ROLES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onRoleChange(option);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide hover:bg-muted"
          >
            {ROLE_LABELS[option]}
            {option === role && <Check className="size-3.5 text-brand" />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
