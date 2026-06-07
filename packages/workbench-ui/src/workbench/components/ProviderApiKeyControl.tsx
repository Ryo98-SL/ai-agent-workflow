import type { ProviderKeyPreference, UsagePriority } from "@ai-agent-workflow/workflow-domain";
import { Check, ChevronDown, Coins, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@workbench/lib/utils";
import { Input } from "@workbench/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workbench/components/ui/dialog";
import { useApplyCredits, useCredits } from "../../data/useAccount";
import { useProviderKeyStore } from "../../data/useProviderKeyStore";
import { Button } from "./Button";
import { FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "./fieldStyles";
import { Popover } from "./Popover";

type ProviderApiKeyControlProps = {
  provider: string;
  preference?: ProviderKeyPreference;
  onPreferenceChange: (preference: ProviderKeyPreference) => void;
};

/**
 * Per-provider API-key control rendered in a model group header: shows the
 * active key's label and opens a popover to switch, add (via modal), or remove
 * stored keys for that provider.
 */
export function ProviderApiKeyControl({ provider, preference, onPreferenceChange }: ProviderApiKeyControlProps) {
  const store = useProviderKeyStore();
  const keys = store.keysForProvider(provider);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const usagePriority: UsagePriority = preference?.usagePriority ?? "credits";
  const selectedKey = keys.find((key) => key.id === preference?.providerKeyId);
  const usingApiKey = usagePriority === "apiKey";

  const setUsagePriority = (next: UsagePriority) => {
    onPreferenceChange({ providerKeyId: preference?.providerKeyId, usagePriority: next });
  };

  const selectKey = (id: string) => {
    onPreferenceChange({ providerKeyId: id, usagePriority: "apiKey" });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await store.deleteKey(id);
    if (preference?.providerKeyId === id) {
      onPreferenceChange({ providerKeyId: undefined, usagePriority });
    }
  };

  return (
    <>
      <Popover
        id={`provider-key-${provider}`}
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        preserveNestedPopoverPress={false}
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="secondary"
            size="unstyled"
            className="h-6 gap-1.5 rounded-md px-2 text-[11px] font-medium"
            onClick={() => setOpen((current) => !current)}
            aria-label={`Manage ${provider} API keys`}
          >
            {usingApiKey ? (
              selectedKey ? (
                <>
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                  <span className="max-w-24 truncate">{selectedKey.label}</span>
                </>
              ) : (
                <>
                  <KeyRound size={12} className="text-muted-foreground" aria-hidden />
                  <span>API Key</span>
                </>
              )
            ) : (
              <>
                <Coins size={12} className="text-muted-foreground" aria-hidden />
                <span>AI credits</span>
              </>
            )}
            <ChevronDown size={12} className="text-muted-foreground" aria-hidden />
          </Button>
        )}
      >
        <div className="w-64 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">Usage Priority</span>
            <div className="flex rounded-md border border-border p-0.5">
              <UsagePriorityTab active={!usingApiKey} onClick={() => setUsagePriority("credits")}>
                AI credits
              </UsagePriorityTab>
              <UsagePriorityTab active={usingApiKey} onClick={() => setUsagePriority("apiKey")}>
                API Key
              </UsagePriorityTab>
            </div>
          </div>

          {usingApiKey ? (
            <p className="px-3 pt-2 text-[11px] text-muted-foreground">Runs use the API key selected below.</p>
          ) : (
            <CreditsPanel isAnon={store.isAnon} />
          )}

          <div className="max-h-56 overflow-y-auto py-1">
            {store.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
              </div>
            ) : keys.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">No keys yet for this provider.</p>
            ) : (
              keys.map((key) => {
                const selected = key.id === preference?.providerKeyId;
                return (
                  <div key={key.id} className="group/key flex items-center gap-1 px-1.5">
                    <Button
                      variant="ghost"
                      size="unstyled"
                      className="min-w-0 flex-1 justify-start gap-2 px-2 py-1.5 text-sm"
                      onClick={() => selectKey(key.id)}
                    >
                      <KeyRound size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-left">{key.label}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">••••{key.last4}</span>
                      {selected && <Check size={14} className="shrink-0 text-brand" aria-hidden />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="iconMd"
                      aria-label={`Remove ${key.label}`}
                      className="opacity-0 group-hover/key:opacity-100"
                      disabled={store.isMutating}
                      onClick={() => handleDelete(key.id)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {!store.isPersisted && (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Keys are kept only for this session. Sign in to save them.
            </p>
          )}

          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="unstyled"
              className="h-8 w-full justify-start gap-2 px-2 text-sm text-brand"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
            >
              <Plus size={15} aria-hidden /> Add API Key
            </Button>
          </div>
        </div>
      </Popover>

      <AddApiKeyDialog
        provider={provider}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => onPreferenceChange({ providerKeyId: id, usagePriority: "apiKey" })}
      />
    </>
  );
}

function CreditsPanel({ isAnon }: { isAnon: boolean }) {
  const { data, isLoading } = useCredits();
  const apply = useApplyCredits();

  if (isAnon) {
    return <p className="px-3 pt-2 text-[11px] text-muted-foreground">Sign in to use AI credits.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-muted-foreground">
        <Loader2 size={12} className="animate-spin" aria-hidden /> Loading credits…
      </div>
    );
  }

  if (data?.status === "approved") {
    const balance = data.balanceTokens ?? 0;
    return (
      <p className="px-3 pt-2 text-[11px]">
        {balance > 0 ? (
          <span className="text-muted-foreground">
            AI credits balance: <span className="font-medium text-foreground">{balance.toLocaleString()}</span> tokens
          </span>
        ) : (
          <span className="text-destructive">AI credits used up — switch to API Key.</span>
        )}
      </p>
    );
  }

  return (
    <div className="px-3 pt-2">
      <p className="text-[11px] text-muted-foreground">Apply once to run on shared AI credits.</p>
      <Button
        variant="success"
        size="sm"
        fullWidth
        className="mt-1.5"
        disabled={apply.isPending}
        onClick={() => apply.mutate()}
      >
        {apply.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Apply for AI credits"}
      </Button>
      {apply.isError && <p className="mt-1 text-[11px] text-destructive">Could not apply. Try again.</p>}
    </div>
  );
}

function UsagePriorityTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
        active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function AddApiKeyDialog({
  provider,
  open,
  onOpenChange,
  onCreated,
}: {
  provider: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const store = useProviderKeyStore();
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setLabel("");
    setApiKey("");
    setError(null);
    setSaving(false);
  };

  const submit = async () => {
    const trimmedLabel = label.trim();
    const trimmedKey = apiKey.trim();
    if (!trimmedLabel || !trimmedKey) return;
    setSaving(true);
    setError(null);
    try {
      const created = await store.createKey({ provider, label: trimmedLabel, apiKey: trimmedKey });
      onCreated(created.id);
      reset();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save API key.");
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {provider} API Key</DialogTitle>
          <DialogDescription>
            {store.isPersisted
              ? "Saved to your account and encrypted at rest."
              : "Kept only for this session — sign in to save keys."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Label</span>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Personal, Work"
              autoFocus
              autoComplete={"off"}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">API Key</span>
            <div className={FIELD_SHELL_CLASS}>
              <KeyRound size={14} className="text-muted-foreground" aria-hidden />
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className={FIELD_SHELL_INPUT_CLASS}
                placeholder="Paste your API key"
                type="password"
                autoComplete={"off"}
                name={"apiKey"}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </div>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="success" disabled={!label.trim() || !apiKey.trim() || saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
