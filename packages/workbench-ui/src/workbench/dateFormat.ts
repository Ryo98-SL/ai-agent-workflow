const WORKBENCH_DATE_LOCALE = "en-US";

const minuteDateFormatter = new Intl.DateTimeFormat(WORKBENCH_DATE_LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const secondDateFormatter = new Intl.DateTimeFormat(WORKBENCH_DATE_LOCALE, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatWorkbenchDate(value: string | number | Date, options: { includeSeconds?: boolean } = {}): string {
  const date = value instanceof Date ? value : new Date(value);
  return (options.includeSeconds ? secondDateFormatter : minuteDateFormatter).format(date);
}
