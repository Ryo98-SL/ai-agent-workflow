import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, KeyRound, Plus, Search, X } from "lucide-react";
import type { ModelProvider } from "@ai-agent-workflow/workflow-domain";
import { Button } from "@workbench/workbench/components/Button";
import { Popover } from "@workbench/workbench/components/Popover";
import { ModelCapabilityTags } from "@workbench/workbench/components/ModelCapabilityTags";
import { ModelProviderLogo } from "@workbench/workbench/components/modelProviderVisuals";
import {
  getModelCapabilities,
  getProviderOption,
  PROVIDER_OPTIONS,
  type ProviderOption,
} from "@workbench/workbench/components/modelCatalog";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "@workbench/workbench/components/fieldStyles";
import { Input } from "@workbench/components/ui/input";
import { Badge } from "@workbench/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workbench/components/ui/select";
import { ThemeProvider } from "@workbench/theme/ThemeProvider";
import { ThemeMenu } from "@workbench/theme/ThemeMenu";

/**
 * Design exploration page (not wired into the product yet).
 *
 * Problem being solved: the live Model Settings editor exposes a free-text
 * "Model name" field that lets users rewrite the *name* of a curated preset
 * model — which is meaningless. Instead, presets should be pick-only, and a
 * dedicated "custom model" flow should let a user keep one of our preset
 * providers (so we still route through the right SDK) while typing their own
 * model id + API key. "Base URL" is also relabelled to the clearer
 * "Custom API endpoint URL (optional)".
 *
 * Three interaction proposals are mocked below so we can compare before
 * committing one back into <ModelSettingsEditor />.
 */

type DraftSettings = {
  provider: ModelProvider;
  model: string;
  apiKey: string;
  endpoint: string;
  isCustom: boolean;
};

const CATALOG = PROVIDER_OPTIONS;

function providerOf(provider: ModelProvider): ProviderOption {
  return getProviderOption(provider) ?? CATALOG[0];
}

function makeDraft(provider: ModelProvider): DraftSettings {
  const option = providerOf(provider);
  return { provider, model: option.defaultModel, apiKey: "", endpoint: "", isCustom: false };
}

export function ModelSettingsDesignGallery() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to workbench">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-semibold leading-tight">Model Setting · 交互方案探索</h1>
                <p className="text-xs text-muted-foreground">预置模型「只选不改」 + 自定义模型流程 + Custom API endpoint URL</p>
              </div>
            </div>
            <ThemeMenu />
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
          <ProblemNote />
          <div className="grid gap-8 lg:grid-cols-3">
            <ProposalCard
              tag="方案 A"
              title="分段模式切换"
              summary="Provider 在上，下面用「预置 / 自定义」分段开关。预置走只读下拉，自定义才出现可编辑的 Model name。"
              pros={["心智最直接：一眼看清当前在用预置还是自定义", "字段始终可见，无隐藏路径", "实现成本最低"]}
              cons={["纵向占位较高", "两套字段并存，面板偏长"]}
            >
              <ProposalSegmented />
            </ProposalCard>

            <ProposalCard
              tag="方案 B"
              title="下拉内嵌「添加自定义模型」"
              summary="沿用现有的模型下拉，把自定义入口收进列表底部。选中后自定义模型像普通项一样带「自定义」标记。"
              pros={["与现有 Model 选择器一致，改动最小", "预置与自定义统一在一个入口", "面板最紧凑"]}
              cons={["自定义入口藏在下拉里，发现性稍弱", "下拉内嵌表单交互略复杂"]}
            >
              <ProposalCombobox />
            </ProposalCard>

            <ProposalCard
              tag="方案 C"
              title="独立「自定义模型」对话框"
              summary="默认展示只读的预置选择；自定义是一个显眼的次级按钮，点开弹窗集中填写 provider / 模型名 / Key / endpoint。"
              pros={["主流程极干净，预置体验不被打扰", "自定义信息集中校验，适合放校验/说明", "扩展性最好（未来可加更多自定义项）"]}
              cons={["自定义需多一次点击进入弹窗", "弹窗实现成本最高"]}
            >
              <ProposalDialog />
            </ProposalCard>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

/* ----------------------------------------------------------------------------
 * Shared scaffolding
 * ------------------------------------------------------------------------- */

function ProblemNote() {
  return (
    <section className="rounded-lg border border-border bg-muted/40 p-5">
      <h2 className="text-sm font-semibold">为什么要改</h2>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        <li>
          • 现在的 <code className="rounded bg-muted px-1">Model name</code> 是自由文本，等于允许用户「重命名」我们维护的预置模型 —— 没有意义且容易误操作。
        </li>
        <li>• 预置模型应当<strong className="text-foreground">只选不改</strong>；想用列表里没有的模型时，走单独的「自定义模型」流程：复用预置 provider + 自填模型名 + API Key。</li>
        <li>
          • <code className="rounded bg-muted px-1">Base URL</code> → <code className="rounded bg-muted px-1">Custom API endpoint URL（选填）</code>，语义更清晰。
        </li>
      </ul>
    </section>
  );
}

function ProposalCard({
  tag,
  title,
  summary,
  pros,
  cons,
  children,
}: {
  tag: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="space-y-2 border-b border-border p-5">
        <Badge variant="secondary" className="w-fit">{tag}</Badge>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
      </div>
      <div className="border-b border-border p-5">{children}</div>
      <div className="grid grid-cols-1 gap-3 p-5 text-xs">
        <ProConList label="优点" tone="pro" items={pros} />
        <ProConList label="代价" tone="con" items={cons} />
      </div>
    </section>
  );
}

function ProConList({ label, tone, items }: { label: string; tone: "pro" | "con"; items: string[] }) {
  return (
    <div>
      <p className={tone === "pro" ? "font-semibold text-brand" : "font-semibold text-muted-foreground"}>{label}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{tone === "pro" ? "+ " : "− "}{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FieldLabel({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProviderPills({
  value,
  onChange,
}: {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATALOG.map((option) => {
        const active = option.provider === value;
        return (
          <button
            key={option.provider}
            type="button"
            onClick={() => onChange(option.provider)}
            className={[
              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-brand bg-brand/10 text-foreground"
                : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            ].join(" ")}
          >
            <span className="flex size-5 items-center justify-center rounded border border-border bg-background">
              <ModelProviderLogo provider={option.provider} />
            </span>
            {option.label}
            {active && <Check size={13} className="text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/** Provider picker built on the internal workbench Popover so it nests cleanly
 * inside another Popover (the outsidePress guard keeps the parent open) and can
 * show each provider's logo. */
function ProviderPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = providerOf(value);
  return (
    <Popover
      id={id}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      matchReferenceWidth
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="secondary"
          size="unstyled"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          onClick={() => setOpen((c) => !c)}
        >
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded border border-border bg-background">
              <ModelProviderLogo provider={value} />
            </span>
            {current.label}
          </span>
          <ChevronDown size={16} className="text-muted-foreground" aria-hidden />
        </Button>
      )}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
        <div className="space-y-1 p-2">
          {CATALOG.map((p) => {
            const selected = p.provider === value;
            return (
              <Button
                key={p.provider}
                variant="modelOption"
                size="unstyled"
                className="px-2"
                onClick={() => {
                  onChange(p.provider);
                  setOpen(false);
                }}
              >
                <span className="flex size-6 items-center justify-center rounded-md border border-border bg-background">
                  <ModelProviderLogo provider={p.provider} />
                </span>
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                {selected && <Check size={16} className="text-brand" aria-hidden />}
              </Button>
            );
          })}
        </div>
      </div>
    </Popover>
  );
}

function ApiKeyField({
  provider,
  value,
  onChange,
}: {
  provider: ModelProvider;
  value: string;
  onChange: (value: string) => void;
}) {
  if (provider === "ollama") {
    return (
      <FieldLabel label="API Key">
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Ollama runs locally — no API key needed.
        </p>
      </FieldLabel>
    );
  }
  return (
    <FieldLabel label="API Key">
      <div className={FIELD_SHELL_CLASS}>
        <KeyRound size={14} className="text-muted-foreground" aria-hidden />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_SHELL_INPUT_CLASS}
          placeholder="Stored with this workflow"
          type="password"
        />
      </div>
    </FieldLabel>
  );
}

function EndpointField({
  provider,
  value,
  onChange,
}: {
  provider: ModelProvider;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldLabel label={<>Custom API endpoint URL <span className="text-muted-foreground/70">(optional)</span></>}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_INPUT_CLASS}
        placeholder={providerOf(provider).defaultBaseURL}
      />
    </FieldLabel>
  );
}

function CustomModelBadge() {
  return <Badge variant="outline" className="border-brand/40 text-brand">Custom</Badge>;
}

/* ----------------------------------------------------------------------------
 * 方案 A — Segmented preset / custom
 * ------------------------------------------------------------------------- */

function ProposalSegmented() {
  const [draft, setDraft] = useState<DraftSettings>(() => makeDraft("deepseek"));
  const option = providerOf(draft.provider);

  const selectProvider = (provider: ModelProvider) => {
    const next = providerOf(provider);
    setDraft((current) => ({
      ...current,
      provider,
      // keep custom name when staying in custom mode, otherwise reset to default preset
      model: current.isCustom ? current.model : next.defaultModel,
    }));
  };

  const setMode = (isCustom: boolean) => {
    setDraft((current) => ({
      ...current,
      isCustom,
      model: isCustom ? "" : providerOf(current.provider).defaultModel,
    }));
  };

  return (
    <div className="space-y-3">
      <FieldLabel label="Provider">
        <ProviderPills value={draft.provider} onChange={selectProvider} />
      </FieldLabel>

      <div className="inline-flex rounded-md border border-input p-0.5 text-xs font-medium">
        {[
          { key: false, label: "Preset" },
          { key: true, label: "Custom" },
        ].map((tab) => {
          const active = draft.isCustom === tab.key;
          return (
            <button
              key={String(tab.key)}
              type="button"
              onClick={() => setMode(tab.key)}
              className={[
                "rounded px-3 py-1.5 transition-colors",
                active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {draft.isCustom ? (
        <FieldLabel label="Model name">
          <div className={FIELD_SHELL_CLASS}>
            <input
              value={draft.model}
              onChange={(event) => setDraft((c) => ({ ...c, model: event.target.value }))}
              className={FIELD_SHELL_INPUT_CLASS}
              placeholder={`e.g. ${option.defaultModel}`}
              autoFocus
            />
            {draft.model && <ModelCapabilityTags capabilities={getModelCapabilities(draft.model, draft.provider)} />}
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground">Routed through the {option.label} API.</span>
        </FieldLabel>
      ) : (
        <FieldLabel label="Model">
          <Select value={draft.model} onValueChange={(model) => setDraft((c) => ({ ...c, model }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {option.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <span className="flex items-center gap-2">
                    {model.id}
                    <ModelCapabilityTags capabilities={model.capabilities} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
      )}

      <ApiKeyField provider={draft.provider} value={draft.apiKey} onChange={(apiKey) => setDraft((c) => ({ ...c, apiKey }))} />
      <EndpointField provider={draft.provider} value={draft.endpoint} onChange={(endpoint) => setDraft((c) => ({ ...c, endpoint }))} />
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * 方案 B — Combobox with inline "add custom model"
 * ------------------------------------------------------------------------- */

function ProposalCombobox() {
  const [draft, setDraft] = useState<DraftSettings>(() => makeDraft("deepseek"));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [query, setQuery] = useState("");
  const [customProvider, setCustomProvider] = useState<ModelProvider>("deepseek");
  const [customModel, setCustomModel] = useState("");

  const option = providerOf(draft.provider);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      CATALOG.map((p) => ({
        ...p,
        models: p.models.filter((m) => m.id.toLowerCase().includes(normalizedQuery)),
      })).filter((p) => normalizedQuery === "" || p.models.length > 0),
    [normalizedQuery],
  );

  const pickPreset = (provider: ModelProvider, model: string) => {
    setDraft((c) => ({ ...c, provider, model, isCustom: false }));
    closeAll();
  };

  const addCustom = () => {
    if (!customModel.trim()) return;
    setDraft((c) => ({ ...c, provider: customProvider, model: customModel.trim(), isCustom: true }));
    closeAll();
  };

  const closeAll = () => {
    setOpen(false);
    setMode("list");
    setQuery("");
    setCustomModel("");
  };

  return (
    <div className="space-y-3">
      <FieldLabel label="Model">
        <Popover
          id="design-combobox"
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : closeAll())}
          placement="bottom-start"
          matchReferenceWidth
          renderTrigger={({ ref, props }) => (
            <Button
              {...props}
              ref={ref}
              variant="modelTrigger"
              size="unstyled"
              onClick={() => setOpen((c) => !c)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <ModelProviderLogo provider={draft.provider} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{draft.model || "Select a model"}</span>
                  {draft.isCustom && <CustomModelBadge />}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{option.label}</span>
              </span>
              <ModelCapabilityTags capabilities={getModelCapabilities(draft.model, draft.provider)} />
            </Button>
          )}
        >
          <div className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
            {mode === "list" ? (
              <>
                <div className="border-b border-border p-3">
                  <label className={FIELD_SHELL_CLASS}>
                    <Search size={16} className="text-muted-foreground" aria-hidden />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className={FIELD_SHELL_INPUT_CLASS}
                      placeholder="Search model"
                    />
                  </label>
                </div>
                <div className="max-h-60 overflow-y-auto py-2">
                  {filtered.map((p) => (
                    <div key={p.provider} className="pb-2">
                      <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">{p.label}</div>
                      <div className="space-y-1 px-2">
                        {p.models.map((m) => {
                          const selected = !draft.isCustom && draft.provider === p.provider && draft.model === m.id;
                          return (
                            <Button
                              key={m.id}
                              variant="modelOption"
                              size="unstyled"
                              className="px-2"
                              onClick={() => pickPreset(p.provider, m.id)}
                            >
                              <span className="flex size-6 items-center justify-center rounded-md border border-border bg-background">
                                <ModelProviderLogo provider={p.provider} />
                              </span>
                              <span className="min-w-0 flex-1 truncate">{m.id}</span>
                              <ModelCapabilityTags capabilities={m.capabilities} />
                              {selected && <Check size={16} className="text-brand" />}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No models found.</p>}
                </div>
                <div className="border-t border-border p-2">
                  <Button variant="ghost" size="unstyled" className="h-9 w-full justify-start gap-2 px-2 text-sm text-brand" onClick={() => setMode("add")}>
                    <Plus size={16} /> Add custom model
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="unstyled" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setMode("list")}>
                    <ArrowLeft size={14} /> Back
                  </Button>
                  <span className="text-sm font-semibold">Custom model</span>
                </div>
                <FieldLabel label="Based on provider">
                  <ProviderPicker id="design-combobox-provider" value={customProvider} onChange={setCustomProvider} />
                </FieldLabel>
                <FieldLabel label="Model name">
                  <Input
                    value={customModel}
                    onChange={(event) => setCustomModel(event.target.value)}
                    className={FIELD_INPUT_CLASS}
                    placeholder={`e.g. ${providerOf(customProvider).defaultModel}`}
                    autoFocus
                  />
                </FieldLabel>
                <Button variant="success" fullWidth disabled={!customModel.trim()} onClick={addCustom}>
                  Add & use
                </Button>
              </div>
            )}
          </div>
        </Popover>
      </FieldLabel>

      <ApiKeyField provider={draft.provider} value={draft.apiKey} onChange={(apiKey) => setDraft((c) => ({ ...c, apiKey }))} />
      <EndpointField provider={draft.provider} value={draft.endpoint} onChange={(endpoint) => setDraft((c) => ({ ...c, endpoint }))} />
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * 方案 C — Dedicated custom-model dialog
 * ------------------------------------------------------------------------- */

function ProposalDialog() {
  const [draft, setDraft] = useState<DraftSettings>(() => makeDraft("deepseek"));
  const [presetOpen, setPresetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const option = providerOf(draft.provider);

  return (
    <div className="space-y-3">
      <FieldLabel label="Model">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-transparent p-2.5">
          <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background">
            <ModelProviderLogo provider={draft.provider} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{draft.model}</span>
              {draft.isCustom && <CustomModelBadge />}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{option.label}</span>
          </span>
          <Popover
            id="design-preset"
            open={presetOpen}
            onOpenChange={setPresetOpen}
            placement="bottom-end"
            renderTrigger={({ ref, props }) => (
              <Button {...props} ref={ref} variant="secondary" size="sm" onClick={() => setPresetOpen((c) => !c)}>
                Change
              </Button>
            )}
          >
            <div className="w-64 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
              <div className="max-h-60 overflow-y-auto py-2">
                {CATALOG.map((p) => (
                  <div key={p.provider} className="pb-2">
                    <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">{p.label}</div>
                    <div className="space-y-1 px-2">
                      {p.models.map((m) => {
                        const selected = !draft.isCustom && draft.provider === p.provider && draft.model === m.id;
                        return (
                          <Button
                            key={m.id}
                            variant="modelOption"
                            size="unstyled"
                            className="px-2"
                            onClick={() => {
                              setDraft((c) => ({ ...c, provider: p.provider, model: m.id, isCustom: false }));
                              setPresetOpen(false);
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate">{m.id}</span>
                            <ModelCapabilityTags capabilities={m.capabilities} />
                            {selected && <Check size={16} className="text-brand" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Popover>
        </div>
      </FieldLabel>

      <Button variant="secondary" fullWidth className="border-dashed" onClick={() => setDialogOpen(true)}>
        <Plus size={16} /> Use a custom model
      </Button>

      <ApiKeyField provider={draft.provider} value={draft.apiKey} onChange={(apiKey) => setDraft((c) => ({ ...c, apiKey }))} />
      <EndpointField provider={draft.provider} value={draft.endpoint} onChange={(endpoint) => setDraft((c) => ({ ...c, endpoint }))} />

      {dialogOpen && (
        <CustomModelDialog
          initial={draft}
          onClose={() => setDialogOpen(false)}
          onSave={(next) => {
            setDraft({ ...next, isCustom: true });
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CustomModelDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: DraftSettings;
  onClose: () => void;
  onSave: (draft: DraftSettings) => void;
}) {
  const [provider, setProvider] = useState<ModelProvider>(initial.provider);
  const [model, setModel] = useState(initial.isCustom ? initial.model : "");
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [endpoint, setEndpoint] = useState(initial.endpoint);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="关闭" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Custom model</h4>
          <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Reuse a preset provider's integration to run a model it supports but we don't list.</p>

        <FieldLabel label="Based on provider">
          <ProviderPicker id="design-dialog-provider" value={provider} onChange={setProvider} />
        </FieldLabel>

        <FieldLabel label="Model name">
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className={FIELD_INPUT_CLASS}
            placeholder={`e.g. ${providerOf(provider).defaultModel}`}
            autoFocus
          />
        </FieldLabel>

        <ApiKeyField provider={provider} value={apiKey} onChange={setApiKey} />
        <EndpointField provider={provider} value={endpoint} onChange={setEndpoint} />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" disabled={!model.trim()} onClick={() => onSave({ provider, model: model.trim(), apiKey, endpoint, isCustom: true })}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
