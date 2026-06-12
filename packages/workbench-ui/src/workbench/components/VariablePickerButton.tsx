import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover } from "./Popover";
import { VariablePicker } from "./VariablePicker";
import { VariableTag } from "./VariableTag";
import { useAvailableVariables } from "./WorkflowGraphContext";

/**
 * Inline control for picking a single Variable Reference (used by If/Else
 * conditions). The trigger shows the current reference as a Variable Tag, or a
 * placeholder when empty; clicking opens the searchable Variable Picker to the
 * left (matching Dify). Selecting swaps the stored `{{nodeId.path}}` string.
 */
export function VariablePickerButton({
  nodeId,
  value,
  onChange,
  placeholder = "选择变量",
}: {
  nodeId: string;
  value: string;
  onChange: (reference: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const groups = useAvailableVariables(nodeId);

  return (
    <Popover
      id={`variable-picker-${nodeId}`}
      open={open}
      onOpenChange={setOpen}
      placement="left-start"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="选择变量"
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-left transition-colors hover:border-brand/50"
        >
          <span className="min-w-0 flex-1">
            {value ? (
              <VariableTag reference={value} />
            ) : (
              <span className="text-xs text-muted-foreground/70">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
        <VariablePicker
          groups={groups}
          onSelect={(reference) => {
            onChange(reference);
            setOpen(false);
          }}
        />
      </div>
    </Popover>
  );
}
