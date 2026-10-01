/** The IANA zone if the runtime knows it, otherwise UTC. Safe to embed in SQL. */
export function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

/** Calendar year and month (1–12) of `now` in `timezone`. */
export function currentYearMonth(
  timezone: string,
  now: Date = new Date(),
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}
