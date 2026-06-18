import type { JsonValue, ToolDescriptor, ToolParamSpec } from "@ai-agent-workflow/workflow-domain";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { Input } from "@workbench/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workbench/components/ui/select";
import { VariableRichTextEditor } from "../richtext/VariableRichTextEditor";
import { localizedToolDescriptor } from "./localizedToolDescriptor";

type ToolParamFormProps = {
  /** Consumer node id — scopes the `/` variable typeahead in string fields. */
  nodeId: string;
  descriptor: ToolDescriptor;
  params: Record<string, JsonValue>;
  onChange: (params: Record<string, JsonValue>) => void;
};

/**
 * Renders a Tool node's inputs from its descriptor's declarative param-spec
 * (ADR 0003). One control per param `type`; `supportsVariables` strings use the
 * shared variable-aware rich-text editor. This is the single renderer for built-in
 * and (future) MCP tools, so no tool needs a hand-written inspector.
 */
export function ToolParamForm({ nodeId, descriptor, params, onChange }: ToolParamFormProps) {
  const { t } = useTranslation("workbench");
  const localizedDescriptor = localizedToolDescriptor(descriptor, t);
  const setParam = (name: string, value: JsonValue) => onChange({ ...params, [name]: value });

  return (
    <div className="space-y-4">
      {localizedDescriptor.params.map((spec) => (
        <ParamField
          key={spec.name}
          nodeId={nodeId}
          spec={spec}
          value={params[spec.name]}
          onChange={(value) => setParam(spec.name, value)}
        />
      ))}
    </div>
  );
}

function asString(value: JsonValue | undefined, fallback: JsonValue | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  return typeof fallback === "string" ? fallback : "";
}

function ParamField({
  nodeId,
  spec,
  value,
  onChange,
}: {
  nodeId: string;
  spec: ToolParamSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
}) {
  if (spec.type === "boolean") {
    const checked = value === undefined ? spec.default === true : value === true;
    return (
      <label className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{spec.label}</span>
          {spec.help && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{spec.help}</span>}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--brand))]"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {spec.label}
        {spec.required && <span className="text-destructive"> *</span>}
      </span>
      <ParamControl nodeId={nodeId} spec={spec} value={value} onChange={onChange} />
      {spec.help && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{spec.help}</span>}
    </label>
  );
}

function ParamControl({
  nodeId,
  spec,
  value,
  onChange,
}: {
  nodeId: string;
  spec: ToolParamSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
}) {
  if (spec.supportsVariables && (spec.type === "string" || spec.type === "text")) {
    return (
      <VariableRichTextEditor
        nodeId={nodeId}
        ariaLabel={spec.label}
        multiline={spec.type === "text"}
        value={asString(value, spec.default)}
        onChange={onChange}
        placeholder={spec.placeholder}
        className={spec.type === "text" ? "min-h-28" : undefined}
      />
    );
  }

  if (spec.type === "select") {
    return (
      <Select value={asString(value, spec.default)} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={spec.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {(spec.options ?? []).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (spec.type === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? String(value) : typeof spec.default === "number" ? String(spec.default) : ""}
        placeholder={spec.placeholder}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    );
  }

  if (spec.type === "text") {
    return (
      <textarea
        aria-label={spec.label}
        value={asString(value, spec.default)}
        placeholder={spec.placeholder}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="block min-h-28 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-5 shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-brand"
      />
    );
  }

  return (
    <Input
      value={asString(value, spec.default)}
      placeholder={spec.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
