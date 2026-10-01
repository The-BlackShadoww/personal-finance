"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useProfile } from "@/lib/hooks/useProfile";
import { DEFAULT_MONEY_FORMAT, setMoneyFormat, type MoneyFormat } from "@/lib/utils/money";

// Remembers the last format so a returning user does not see dollars flash
// before their profile loads. A per-browser convenience only.
const STORAGE_KEY = "pf-money-format";

function readStoredFormat(): MoneyFormat | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return typeof parsed?.currency === "string" && typeof parsed?.locale === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function storeFormat(format: MoneyFormat) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(format));
  } catch {
    // Storage unavailable: the profile still sets the format each visit.
  }
}

/**
 * Applies the signed-in user's currency and locale to every money helper in
 * `lib/utils/money`. The subtree is keyed by the format, so changing currency
 * remounts it and every amount re-renders.
 */
export function MoneyFormatProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  // Starts at the default so the first client render matches the server.
  const [format, setFormat] = useState<MoneyFormat>(DEFAULT_MONEY_FORMAT);

  useEffect(() => {
    const stored = readStoredFormat();
    if (stored) setFormat(stored);
  }, []);

  useEffect(() => {
    if (!profile?.currency || !profile.locale) return;
    const next = { currency: profile.currency, locale: profile.locale };
    setFormat((current) =>
      current.currency === next.currency && current.locale === next.locale ? current : next,
    );
    storeFormat(next);
  }, [profile?.currency, profile?.locale]);

  // Module state is only touched in the browser; the server always renders
  // with the default.
  if (typeof window !== "undefined") {
    setMoneyFormat(format);
  }

  return <Fragment key={`${format.currency}|${format.locale}`}>{children}</Fragment>;
}
