import type { KnowledgeBaseSettings } from "@ai-agent-workflow/api-contracts";
import { Input } from "@workbench/components/ui/input";

/** Tuning params editable at creation. Embedding provider/model stay platform defaults (MVP). */
export type EditableKnowledgeSettings = {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  scoreThreshold: number;
};

export const DEFAULT_EDITABLE_SETTINGS: EditableKnowledgeSettings = {
  chunkSize: 800,
  chunkOverlap: 120,
  topK: 5,
  scoreThreshold: 0.3,
};

/** Bounds mirror KnowledgeBaseSettingsSchema in @ai-agent-workflow/api-contracts. */
const BOUNDS = {
  chunkSize: { min: 200, max: 8000, step: 50 },
  chunkOverlap: { min: 0, max: 2000, step: 10 },
  topK: { min: 1, max: 20, step: 1 },
  scoreThreshold: { min: 0, max: 1, step: 0.05 },
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Round to the step's decimal precision so fractional steps don't accumulate float noise. */
const roundToStep = (value: number, step: number) => {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(value.toFixed(decimals));
};

type EditProps = {
  mode: "edit";
  value: EditableKnowledgeSettings;
  onChange: (next: EditableKnowledgeSettings) => void;
};

type ReadProps = {
  mode: "read";
  settings: KnowledgeBaseSettings;
};

/**
 * Knowledge base settings. In `edit` mode it exposes chunking/retrieval tuning params;
 * in `read` mode it renders the persisted settings as disabled fields. Embedding
 * provider/model are always read-only (platform-managed in the MVP).
 */
export function KnowledgeSettingsFields(props: EditProps | ReadProps) {
  const embedding = props.mode === "read" ? props.settings.embedding : { provider: "openai", model: "text-embedding-3-small" };

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ReadOnlyField label="Embedding Provider" value={embedding.provider} hint="Platform-managed" />
        <ReadOnlyField label="Embedding Model" value={embedding.model} hint="Platform-managed" />
      </div>
      {props.mode === "read" ? (
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Chunk Size" value={String(props.settings.chunking.chunkSize)} />
          <ReadOnlyField label="Chunk Overlap" value={String(props.settings.chunking.chunkOverlap)} />
          <ReadOnlyField label="Top K" value={String(props.settings.retrieval.topK)} />
          <ReadOnlyField label="Score Threshold" value={String(props.settings.retrieval.scoreThreshold ?? "—")} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Chunk Size"
            id="kb-settings-chunk-size"
            value={props.value.chunkSize}
            bounds={BOUNDS.chunkSize}
            onChange={(chunkSize) => props.onChange({ ...props.value, chunkSize })}
          />
          <NumberField
            label="Chunk Overlap"
            id="kb-settings-chunk-overlap"
            value={props.value.chunkOverlap}
            bounds={BOUNDS.chunkOverlap}
            onChange={(chunkOverlap) => props.onChange({ ...props.value, chunkOverlap })}
          />
          <NumberField
            label="Top K"
            id="kb-settings-top-k"
            value={props.value.topK}
            bounds={BOUNDS.topK}
            onChange={(topK) => props.onChange({ ...props.value, topK })}
          />
          <NumberField
            label="Score Threshold"
            id="kb-settings-score-threshold"
            value={props.value.scoreThreshold}
            bounds={BOUNDS.scoreThreshold}
            onChange={(scoreThreshold) => props.onChange({ ...props.value, scoreThreshold })}
          />
        </div>
      )}
    </section>
  );
}

function NumberField({
  label,
  id,
  value,
  bounds,
  onChange,
}: {
  label: string;
  id: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        id={id}
        type="number"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isNaN(next)) return;
          onChange(roundToStep(clamp(next, bounds.min, bounds.max), bounds.step));
        }}
      />
      <span className="mt-1 block text-[10px] text-muted-foreground">
        {bounds.min}–{bounds.max}
      </span>
    </label>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input value={value} disabled />
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
