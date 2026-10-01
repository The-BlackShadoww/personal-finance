"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useProfile, useUpdateProfile } from "@/lib/hooks/useProfile";
import { Notice, SectionTitle } from "./ui";

// Shown first; every other ISO 4217 code follows in a second group.
const COMMON_CURRENCIES = [
  "BDT", "USD", "EUR", "GBP", "INR", "PKR", "NPR", "LKR", "AED", "SAR",
  "MYR", "SGD", "CAD", "AUD", "JPY", "CNY",
];

// Number formats differ mainly in grouping and separators.
const NUMBER_FORMATS = [
  { locale: "en-US", label: "1,234,567.89" },
  { locale: "en-IN", label: "12,34,567.89 (lakh / crore)" },
  { locale: "de-DE", label: "1.234.567,89" },
  { locale: "fr-FR", label: "1 234 567,89" },
  { locale: "de-CH", label: "1’234’567.89" },
];

const SAMPLE_AMOUNT = 1234567.89;

function allCurrencies(): string[] {
  try {
    return Intl.supportedValuesOf("currency");
  } catch {
    return COMMON_CURRENCIES;
  }
}

function currencyName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function preview(currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      numberingSystem: "latn",
    }).format(SAMPLE_AMOUNT);
  } catch {
    return "";
  }
}

export function CurrencySection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const [currency, setCurrency] = useState("USD");
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (!profile) return;
    setCurrency(profile.currency ?? "USD");
    setLocale(profile.locale ?? "en-US");
  }, [profile]);

  const otherCurrencies = useMemo(
    () => allCurrencies().filter((code) => !COMMON_CURRENCIES.includes(code)),
    [],
  );
  // Keep a locale set elsewhere (e.g. via the API) selectable.
  const numberFormats = NUMBER_FORMATS.some((format) => format.locale === locale)
    ? NUMBER_FORMATS
    : [...NUMBER_FORMATS, { locale, label: locale }];

  const isDirty = profile ? currency !== profile.currency || locale !== profile.locale : false;

  async function save() {
    await updateProfile.mutateAsync({ currency, locale });
    // The app remounts with the new format, so confirm with a toast that
    // outlives this component.
    toast.success(`Amounts now show as ${preview(currency, locale)}.`);
  }

  return (
    <section className="border-t border-line pt-10">
      <SectionTitle
        title="Currency & number format"
        description="How amounts are displayed across the app and in PDF reports. Changing it does not convert existing amounts."
      />
      {isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="currency">Currency</label>
              <select id="currency" className="field" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <optgroup label="Common">
                  {COMMON_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code} · {currencyName(code)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="All currencies">
                  {otherCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code} · {currencyName(code)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="number-format">Number format</label>
              <select id="number-format" className="field" value={locale} onChange={(event) => setLocale(event.target.value)}>
                {numberFormats.map((format) => (
                  <option key={format.locale} value={format.locale}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[13px] text-muted">
            Preview <span className="num ml-1.5 text-[15px] text-foreground">{preview(currency, locale)}</span>
          </p>

          <Notice show={Boolean(updateProfile.error)} tone="error">
            {(updateProfile.error as Error)?.message ?? "Failed to save currency"}
          </Notice>

          <div className="flex items-center gap-4 pt-1">
            <Button type="button" onClick={save} disabled={updateProfile.isPending || !isDirty}>
              {updateProfile.isPending ? <Spinner /> : null}
              {updateProfile.isPending ? "Saving…" : "Save format"}
            </Button>
            {!isDirty && <span className="text-[13px] text-faint">No changes to save</span>}
          </div>
        </div>
      )}
    </section>
  );
}
