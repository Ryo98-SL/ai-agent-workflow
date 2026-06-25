export const EMAIL_USER_MINUTE_LIMIT = 10;
export const EMAIL_USER_DAILY_LIMIT = 100;
export const EMAIL_PLATFORM_DAILY_LIMIT = 80;
export const EMAIL_PLATFORM_MONTHLY_LIMIT = 2_400;

export function emailQuotaWindows(now: Date) {
  const minuteStart = new Date(now.getTime() - 60_000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayReset = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    minuteStart,
    dayStart,
    monthStart,
    resets: {
      userMinute: new Date(now.getTime() + 60_000),
      day: dayReset,
      month: monthReset,
    },
  };
}
