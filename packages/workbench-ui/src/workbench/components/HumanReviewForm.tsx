import { useState } from "react";
import { UserCheck } from "lucide-react";
import type { ResumeRunRequest, RunInterrupt } from "@ai-agent-workflow/api-contracts";
import { Textarea } from "@workbench/components/ui/textarea";
import { Button } from "./Button";

type HumanReviewFormProps = {
  runId: string;
  interrupt: RunInterrupt;
  submitting?: boolean;
  onResumeRun: (runId: string, request: ResumeRunRequest) => void;
};

/** The reviewer-facing form shown while a run is paused on a Human Input node. */
export function HumanReviewForm({ runId, interrupt, submitting = false, onResumeRun }: HumanReviewFormProps) {
  const [text, setText] = useState(interrupt.defaultText ?? "");

  return (
    <section className="space-y-3 rounded-md border border-brand/40 bg-brand/5 p-4">
      <div className="flex items-center gap-2">
        <UserCheck size={15} className="text-brand" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Awaiting your review</h3>
      </div>

      {interrupt.prompt && (
        <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">{interrupt.prompt}</p>
      )}

      {interrupt.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interrupt.actions.map((action) => (
            <Button
              key={action.id}
              variant="secondary"
              size="md"
              disabled={submitting}
              onClick={() => onResumeRun(runId, { action_id: action.id, action_value: action.value })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {interrupt.allowTextInput && (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">{interrupt.inputLabel || "回复内容"}</span>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} disabled={submitting} />
          <Button
            variant="success"
            size="md"
            disabled={submitting || text.trim() === ""}
            onClick={() => onResumeRun(runId, { action_id: "__input__", action_value: text })}
          >
            Submit reply
          </Button>
        </div>
      )}
    </section>
  );
}
