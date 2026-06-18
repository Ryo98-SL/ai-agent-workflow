import type { SupportedLocale } from "@ai-agent-workflow/i18n";

export function formatWorkbenchDate(
  value: string | number | Date,
  options: { includeSeconds?: boolean; locale?: SupportedLocale } = {},
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(options.locale ?? "en-US", {
    ...(options.includeSeconds ? {} : { year: "numeric" as const }),
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.includeSeconds ? { second: "2-digit" as const } : {}),
  }).format(date);
}
