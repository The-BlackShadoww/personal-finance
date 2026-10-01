"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ValuationPrompt } from "@/lib/api/insights";
import { ValuationForm } from "./ValuationForm";

/** "Update the value of Brokerage (last: 34 days ago)." */
export function ValuationPrompts({ prompts }: { prompts: ValuationPrompt[] }) {
  const [updating, setUpdating] = useState<ValuationPrompt | null>(null);
  if (!prompts.length) return null;

  return (
    <>
      <ul className="space-y-2">
        {prompts.map((prompt) => (
          <li key={prompt.accountId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[8px] bg-surface-2 px-4 py-3 text-[13px]">
            <span className="text-muted">
              Update the value of <span className="text-foreground">{prompt.name}</span>
              {prompt.daysSince !== null ? ` (last: ${prompt.daysSince} days ago)` : " (never valued)"}.
            </span>
            <button
              type="button"
              onClick={() => setUpdating(prompt)}
              className="text-foreground underline underline-offset-4 hover:opacity-70"
            >
              Update value
            </button>
          </li>
        ))}
      </ul>
      <Modal
        open={updating !== null}
        title={updating ? `What is ${updating.name} worth?` : "Update value"}
        onClose={() => setUpdating(null)}
      >
        {updating ? (
          <ValuationForm
            key={updating.accountId}
            account={{ id: updating.accountId, name: updating.name }}
            onDone={() => setUpdating(null)}
            onCancel={() => setUpdating(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
