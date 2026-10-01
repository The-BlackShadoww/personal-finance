// Returns the full month name for a month number.
// monthName(1) -> "January", monthName(12) -> "December"
export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });
}

// Returns the abbreviated month name.
// monthNameShort(1) -> "Jan", monthNameShort(12) -> "Dec"
export function monthNameShort(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
}

// Returns a CSS color class string based on whether a value is positive,
// negative, or zero. Used for savings amounts.
export function savingsColorClass(amount: number): string {
  if (amount > 0) return "text-green-fg";
  if (amount < 0) return "text-red-fg";
  return "text-muted";
}
