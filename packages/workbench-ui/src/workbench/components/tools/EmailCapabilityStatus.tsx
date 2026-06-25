import type { EmailCapabilityResponse } from "@ai-agent-workflow/api-contracts";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";

type EmailCapability = EmailCapabilityResponse["email"];

export function EmailCapabilityStatus({
  loading,
  failed,
  email,
}: {
  loading: boolean;
  failed: boolean;
  email?: EmailCapability;
}) {
  const { t } = useTranslation("workbench");
  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" aria-hidden />
        {t("tools.emailSafety.loading", { defaultValue: "Checking email availability..." })}
      </p>
    );
  }
  if (failed || !email) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
        {t("tools.emailSafety.statusError", {
          defaultValue: "Email availability could not be loaded. Real send is disabled.",
        })}
      </p>
    );
  }

  const warning =
    email.reason === "not_configured"
      ? t("tools.emailSafety.notConfigured", { defaultValue: "The server email provider is not configured." })
      : email.reason === "sign_in_required"
        ? t("tools.emailSafety.signIn", { defaultValue: "Sign in to enable real email sending." })
        : email.reason === "quota_unavailable"
          ? t("tools.emailSafety.unavailable", {
              defaultValue: "Quota protection is unavailable, so sending is blocked.",
            })
          : email.reason === "quota_exhausted"
            ? t("tools.emailSafety.exhausted", {
                defaultValue: "The protected email quota is currently exhausted.",
              })
            : null;

  if (warning) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-5 text-amber-700 dark:text-amber-300">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
        {warning}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-1.5 text-xs leading-5 text-brand">
      <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden />
      {t("tools.emailSafety.remaining", {
        defaultValue:
          "Available · {{userMinute}} this minute · {{platformDay}} platform sends today · {{platformMonth}} this month",
        userMinute: email.remaining.userMinute ?? 0,
        platformDay: email.remaining.platformDay ?? 0,
        platformMonth: email.remaining.platformMonth ?? 0,
      })}
    </p>
  );
}
