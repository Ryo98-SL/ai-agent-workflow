import { KeyRound, Server } from "lucide-react";
import type { ReactNode } from "react";
import type { OpenAICompatibleSettings } from "../../domain/workflow/schema";

type ModelSettingsPanelProps = {
  settings?: OpenAICompatibleSettings;
  onChange: (settings: OpenAICompatibleSettings) => void;
};

export function ModelSettingsPanel({ settings, onChange }: ModelSettingsPanelProps) {
  const value = settings || { baseURL: "http://127.0.0.1:8787/v1", model: "mock-gpt", apiKey: "" };

  const update = (patch: Partial<OpenAICompatibleSettings>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <section className="border-b border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Server size={16} className="text-slate-500" aria-hidden />
        <h2 className="text-sm font-semibold">Model Settings</h2>
      </div>
      <div className="space-y-3">
        <Field label="Base URL">
          <input
            value={value.baseURL}
            onChange={(event) => update({ baseURL: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            placeholder="http://127.0.0.1:8787/v1"
          />
        </Field>
        <Field label="Model">
          <input
            value={value.model}
            onChange={(event) => update({ model: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            placeholder="gpt-4.1-mini"
          />
        </Field>
        <Field label="API Key">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2">
            <KeyRound size={14} className="text-slate-400" aria-hidden />
            <input
              value={value.apiKey || ""}
              onChange={(event) => update({ apiKey: event.target.value })}
              className="h-9 min-w-0 flex-1 text-sm outline-none"
              placeholder="Stored in memory only"
              type="password"
            />
          </div>
        </Field>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        API keys are used for runs but omitted from saved workflow files.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
