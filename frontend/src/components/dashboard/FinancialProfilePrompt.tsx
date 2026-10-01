"use client";

import { ArrowRight, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useFinancialProfile } from "@/lib/hooks/useFinancialProfile";

const DISMISSED_KEY = "pf-financial-profile-prompt-dismissed";

/**
 * Asks for the financial-profile answers that tailor targets and advice,
 * until they are complete or the viewer dismisses it on this browser.
 */
export function FinancialProfilePrompt() {
  const { data: profile } = useFinancialProfile();
  // Hidden until storage is read, so a dismissed prompt never flashes.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!profile || profile.isComplete || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: the prompt returns next visit, which is fine.
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div>
        <p className="text-[14px] text-foreground">Five quick questions make your targets fit your life.</p>
        <p className="mt-0.5 text-[13px] text-muted">
          Income stability, dependents, insurance and employer match decide how big your emergency fund should be
          and what to do first.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/settings?tab=financial" className={buttonClass({ className: "w-fit" })}>
          Answer now <ArrowRight size={13} weight="bold" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          title="Dismiss"
          className="grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </section>
  );
}
