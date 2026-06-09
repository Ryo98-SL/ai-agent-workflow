import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
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
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          placeholder="新知识库"
          autoFocus={autoFocus}
        />
      </Field>
      <Field label="Description" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
          placeholder="描述（可选）"
          className="min-h-16 resize-y"
        />
      </Field>
    </>
  );
}
