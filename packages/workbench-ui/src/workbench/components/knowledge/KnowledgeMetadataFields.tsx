import { useTranslation } from "@ai-agent-workflow/i18n";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { Field } from "./shared";

type KnowledgeMetadataFieldsProps = {
  idPrefix: string;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Controlled Name + Description fields shared by the create wizard and the detail pane. */
export function KnowledgeMetadataFields({
  idPrefix,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  disabled = false,
  autoFocus = false,
}: KnowledgeMetadataFieldsProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);

  return (
    <>
      <Field label={t("knowledge.metadata.name")} htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          placeholder={t("knowledge.metadata.namePlaceholder")}
          autoFocus={autoFocus}
        />
      </Field>
      <Field label={t("knowledge.metadata.description")} htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
          placeholder={t("knowledge.metadata.descriptionPlaceholder")}
          className="min-h-16 resize-y"
        />
      </Field>
    </>
  );
}
