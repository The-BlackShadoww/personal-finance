import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query } from "@tanstack/react-query";

const STORAGE_KEY = "pf-query-cache";

/** How long a persisted snapshot may be restored after it was written. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Change when a response shape changes incompatibly, so browsers discard
 * snapshots written by an older build instead of rendering them.
 */
export const PERSIST_BUSTER = "2026-09-30";

/**
 * Persists the query cache to localStorage so a reload or a return visit
 * paints the last known data immediately while fresh data loads. During
 * server rendering there is no storage and this is a no-op persister.
 */
export function createQueryPersister() {
  return createSyncStoragePersister({
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    key: STORAGE_KEY,
    throttleTime: 1000,
  });
}

export function shouldPersistQuery(query: Query) {
  return query.state.status === "success";
}

/**
 * Removes the persisted snapshot. Call whenever the signed-in user changes or
 * the session ends, so one account's financial data is never shown to the
 * next person using the browser.
 */
export function clearPersistedQueries() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); nothing was persisted then.
  }
}
