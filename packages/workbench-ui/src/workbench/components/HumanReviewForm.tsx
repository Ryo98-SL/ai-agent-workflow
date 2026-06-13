import type { ResumeRunRequest, RunInterrupt } from "@ai-agent-workflow/api-contracts";
import { HumanReviewPrompt, type ReviewPromptOption } from "./HumanReviewPrompt";

type HumanReviewFormProps = {
  runId: string;
  interrupt: RunInterrupt;
  submitting?: boolean;
  /** When provided, a collapse button is shown (used by the floating chat dock). */
  onCollapse?: () => void;
  /** Extra classes for the root (e.g. max-height + overflow when docked). */
  className?: string;
  onResumeRun: (runId: string, request: ResumeRunRequest) => void;
};

/**
 * The reviewer-facing form shown while a run is paused on a Human Input node.
 * Maps the interrupt's preset actions + optional free-text reply onto the shared
 * {@link HumanReviewPrompt} template and wires each choice back to resume.
 */
export function HumanReviewForm({
  runId,
  interrupt,
  submitting = false,
  onCollapse,
  className,
  onResumeRun,
}: HumanReviewFormProps) {
  const options: ReviewPromptOption[] = interrupt.actions.map((action) => ({
    id: action.id,
    label: action.label,
  }));

  return (
    <HumanReviewPrompt
      description={interrupt.prompt}
      options={options}
      allowOther={interrupt.allowTextInput}
      otherInputLabel={interrupt.inputLabel || "回复内容"}
      otherDefault={interrupt.defaultText ?? ""}
      disabled={submitting}
      onCollapse={onCollapse}
      className={className}
      onSelect={(optionId) => {
        const action = interrupt.actions.find((item) => item.id === optionId);
        onResumeRun(runId, { action_id: optionId, action_value: action?.value ?? "" });
      }}
      onSubmitOther={(text) => onResumeRun(runId, { action_id: "__input__", action_value: text })}
    />
  );
}
