import type { ReactNode } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import type { StartNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Button } from "../Button";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";

type StartInspectorProps = {
  node: StartNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function StartInspector({ node, updateNode }: StartInspectorProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const names = node.config.fields.map((field) => field.name);

  const updateConfig = (fields: StartNode["config"]["fields"]) => {
    updateNode(node.id, (current) => (current.type === "start" ? { ...current, config: { fields } } : current));
  };

  const updateField = (index: number, patch: Partial<StartNode["config"]["fields"][number]>) => {
    updateConfig(node.config.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    let index = node.config.fields.length + 1;
    while (names.includes(`field${index}`)) {
      index += 1;
    }
    updateConfig([
      {
        name: `field${index}`,
        label: t("inspectors.start.newFieldLabel", { defaultValue: "Field {{index}}", index }),
        required: false,
      },
      ...node.config.fields,
    ]);
  };

  const removeField = (index: number) => {
    updateConfig(node.config.fields.filter((_field, fieldIndex) => fieldIndex !== index));
  };

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("inspectors.start.inputFields", { defaultValue: "Input Fields" })}
          </h3>
          <Button
            variant="successSoft"
            size="sm"
            onClick={addField}
          >
            {t("inspectors.start.addField", { defaultValue: "Add field" })}
          </Button>
        </div>
        {node.config.fields.length === 0 ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {t("inspectors.start.empty", { defaultValue: "No Start inputs configured." })}
          </p>
        ) : (
          <div className="space-y-3">
            {node.config.fields.map((field, index) => {
              const duplicate = names.indexOf(field.name) !== index;
              const invalid = !FIELD_NAME_PATTERN.test(field.name);
              return (
                <div key={index} className="rounded-md border border-border bg-card p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t("inspectors.start.name", { defaultValue: "Name" })}>
                      <Input
                        value={field.name}
                        onChange={(event) => updateField(index, { name: event.target.value })}
                      />
                    </Field>
                    <Field label={t("inspectors.start.label", { defaultValue: "Label" })}>
                      <Input
                        value={field.label || ""}
                        onChange={(event) => updateField(index, { label: event.target.value || undefined })}
                      />
                    </Field>
                  </div>
                  {(invalid || duplicate) && (
                    <p className="mt-2 text-xs text-destructive">
                      {duplicate
                        ? t("inspectors.start.duplicateName", { defaultValue: "Field names must be unique." })
                        : t("inspectors.start.invalidName", {
                            defaultValue: "Use letters, numbers, and underscores only.",
                          })}
                    </p>
                  )}
                  <Field label={t("inspectors.start.defaultValue", { defaultValue: "Default value" })}>
                    <Input
                      value={field.defaultValue || ""}
                      onChange={(event) => updateField(index, { defaultValue: event.target.value || undefined })}
                    />
                  </Field>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-brand"
                      />
                      {t("inspectors.start.required", { defaultValue: "Required" })}
                    </label>
                    <Button variant="dangerGhost" size="sm" onClick={() => removeField(index)}>
                      {t("inspectors.start.remove", { defaultValue: "Remove" })}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
