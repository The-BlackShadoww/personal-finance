/**
 * Largest amount (in major units, e.g. dollars or taka) accepted from clients.
 * Money is stored as bigint minor units, so 1e12 × 100 stays far below
 * Number.MAX_SAFE_INTEGER even when many amounts are summed.
 */
export const MAX_AMOUNT = 1_000_000_000_000;
