import { useEffect, useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";
import { Textarea } from "@workbench/components/ui/textarea";
import { Button } from "./Button";

export type ReviewPromptOption = {
  /** Stable id returned to the caller when this option is chosen. */
  id: string;
  /** Primary label shown on the option row. */
  label: string;
  /** Optional secondary line rendered under the label. */
  description?: string;
};

export type HumanReviewPromptProps = {
  /** Section heading. */
  title?: string;
  /** Free-text description of the decision being requested. */
  description?: string;
  /** Selectable options, rendered as a numbered Claude-style list. */
  options: ReviewPromptOption[];
  /** Append an "Other" row that expands into a free-text reply. */
  allowOther?: boolean;
  /** Label for the trailing "Other" row. */
  otherLabel?: string;
  /** Label shown above the custom-reply textarea. */
  otherInputLabel?: string;
  /** Initial text for the custom-reply textarea. */
  otherDefault?: string;
  /** Disable all interaction (e.g. while a resume is in flight). */
  disabled?: boolean;
  /** When provided, a collapse (chevron) button is shown in the header. */
  onCollapse?: () => void;
  /** Extra classes for the root section (e.g. max-height + overflow when docked). */
  className?: string;
  /** Called with the option id when a preset option is chosen. */
  onSelect: (optionId: string) => void;
  /** Called with the trimmed text when the "Other" reply is submitted. */
  onSubmitOther?: (text: string) => void;
};

/**
 * Claude-style human-in-the-loop prompt: a description followed by a vertical
 * list of options, with an optional trailing "Other" row that expands into a
 * free-text reply. Purely presentational and decoupled from any run/resume
 * wiring, so the same template can back agent-authored HITL moments later.
 */
export function HumanReviewPrompt({
  title = "等待你的复核",
  description,
  options,
  allowOther = false,
  otherLabel = "其他（自定义回复）",
  otherInputLabel,
  otherDefault = "",
  disabled = false,
  onCollapse,
  className,
  onSelect,
  onSubmitOther,
}: HumanReviewPromptProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [text, setText] = useState(otherDefault);
  useEffect(() => {
    setText(otherDefault);
  }, [otherDefault]);

  return (
    <section
      className={["space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-4", className].filter(Boolean).join(" ")}
    >
      <div className="flex items-center gap-2">
        <UserCheck size={15} className="shrink-0 text-brand" aria-hidden />
        <h3 className="flex-1 text-sm font-semibold text-foreground">{title}</h3>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="收起"
            title="收起"
            className="-mr-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        )}
      </div>

      {description && (
        <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">{description}</p>
      )}

      <ul className="space-y-1.5">
        {options.map((option, index) => (
          <li key={option.id}>
            <OptionRow
              index={index + 1}
              label={option.label}
              description={option.description}
              disabled={disabled}
              onClick={() => onSelect(option.id)}
            />
          </li>
        ))}

        {allowOther && (
          <li>
            <OptionRow
              index={options.length + 1}
              label={otherLabel}
              active={otherOpen}
              disabled={disabled}
              onClick={() => setOtherOpen((open) => !open)}
            />
            {otherOpen && (
              <div className="mt-2 space-y-2 pl-[2.125rem]">
                {otherInputLabel && (
                  <span className="block text-xs font-medium text-muted-foreground">{otherInputLabel}</span>
                )}
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={3}
                  autoFocus
                  disabled={disabled}
                  placeholder={otherInputLabel || "输入自定义回复…"}
                />
                <Button
                  variant="success"
                  size="md"
                  disabled={disabled || text.trim() === ""}
                  onClick={() => onSubmitOther?.(text.trim())}
                >
                  提交回复
                </Button>
              </div>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}

/** A single selectable option row: a numbered badge + label (+ optional hint). */
function OptionRow({
  index,
  label,
  description,
  active = false,
  disabled = false,
  onClick,
}: {
  index: number;
  label: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
        active
          ? "border-brand bg-brand/10"
          : "border-border bg-background/60 hover:border-brand/60 hover:bg-brand/5",
        "disabled:cursor-not-allowed disabled:opacity-50",
      ].join(" ")}
    >
      <span
        className={[
          "mt-px inline-flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold",
          active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}
