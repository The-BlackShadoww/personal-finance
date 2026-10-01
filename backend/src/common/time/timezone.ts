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

/** Today's calendar date ("YYYY-MM-DD") in `timezone`. */
export function todayIso(timezone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
