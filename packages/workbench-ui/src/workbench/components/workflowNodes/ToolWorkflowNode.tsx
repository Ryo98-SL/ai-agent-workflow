import { Clock, Mail, Wrench } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function ToolWorkflowNode(props: WorkflowNodeProps) {
  const node = props.data.node;
  const Icon = node.type === "tool" && node.config.adapter === "emailSend" ? Mail : node.type === "tool" && node.config.adapter === "currentTime" ? Clock : Wrench;
  return (
    <WorkflowNodeCardShell {...props} Icon={Icon}>
      {node.type === "tool" && node.config.adapter === "emailSend" ? (
        <div className="mt-1 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">To:</span> {node.config.to || "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{node.config.subject || "(no subject)"}</p>
          <span
            className={[
              "inline-block rounded px-1 text-[10px]",
              node.config.send ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {node.config.send ? "sends for real" : "dry-run"}
          </span>
        </div>
      ) : undefined}
    </WorkflowNodeCardShell>
  );
}
