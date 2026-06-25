import { AlertTriangle, MailCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { useEmailCapability } from "../../../data/useAccount";
import { Button } from "../Button";
import { EmailCapabilityStatus } from "./EmailCapabilityStatus";

type EmailSendControlProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function EmailSendControl({ enabled, onChange }: EmailSendControlProps) {
  const { t } = useTranslation("workbench");
  const capability = useEmailCapability();
  const [confirming, setConfirming] = useState(false);
  const email = capability.data?.email;
  const canEnable = email?.available === true;

  const requestToggle = () => {
    if (enabled) {
      onChange(false);
      setConfirming(false);
      return;
    }
    if (canEnable) setConfirming(true);
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {t("tools.emailSafety.realSend", { defaultValue: "Send for real" })}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {t("tools.emailSafety.dryRunHelp", {
              defaultValue: "Off keeps this tool in dry-run mode. Turning it on sends an external email and consumes quota.",
            })}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-label={t("tools.emailSafety.realSend", { defaultValue: "Send for real" })}
          aria-checked={enabled}
          disabled={!enabled && (capability.isLoading || !canEnable)}
          onClick={requestToggle}
          className={[
            "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45",
            enabled ? "bg-brand" : "bg-muted-foreground/30",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-[18px]" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      <EmailCapabilityStatus loading={capability.isLoading} failed={capability.isError} email={email} />

      {confirming && (
        <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2.5">
          <p className="flex items-start gap-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t("tools.emailSafety.confirmDetail", {
              defaultValue: "Future workflow runs may send a real email. Quota is charged when delivery is attempted, including failed attempts.",
            })}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t("tools.emailSafety.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                onChange(true);
                setConfirming(false);
              }}
            >
              <MailCheck size={13} aria-hidden />
              {t("tools.emailSafety.confirm", { defaultValue: "Enable real send" })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
