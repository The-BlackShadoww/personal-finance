import type { AccountKind, AccountNature } from "@/lib/api/accounts";

type KindMeta = {
  label: string;
  nature: AccountNature;
  /** Default for "spendable within days". */
  liquid: boolean;
  icon: string;
  hint: string;
};

// Mirrors backend/src/modules/accounts/account-kinds.ts.
export const ACCOUNT_KINDS: Record<AccountKind, KindMeta> = {
  bank: { label: "Bank account", nature: "asset", liquid: true, icon: "landmark", hint: "Current or salary account" },
  cash: { label: "Cash", nature: "asset", liquid: true, icon: "banknote", hint: "Money in your wallet" },
  mobile_wallet: { label: "Mobile wallet", nature: "asset", liquid: true, icon: "smartphone", hint: "bKash, Nagad, PayPal…" },
  savings: { label: "Savings", nature: "asset", liquid: true, icon: "piggy-bank", hint: "Emergency fund, deposits" },
  investment: { label: "Investments", nature: "asset", liquid: false, icon: "trending-up", hint: "Funds, shares, bonds" },
  retirement: { label: "Retirement", nature: "asset", liquid: false, icon: "shield", hint: "Pension, provident fund" },
  property: { label: "Property", nature: "asset", liquid: false, icon: "home", hint: "Home, land, vehicle" },
  other: { label: "Other asset", nature: "asset", liquid: false, icon: "wallet", hint: "Anything else you own" },
  credit_card: { label: "Credit card", nature: "liability", liquid: false, icon: "credit-card", hint: "Balance you owe" },
  loan: { label: "Loan", nature: "liability", liquid: false, icon: "landmark", hint: "Personal, student, home loan" },
};

export const ASSET_KINDS = (Object.keys(ACCOUNT_KINDS) as AccountKind[]).filter(
  (kind) => ACCOUNT_KINDS[kind].nature === "asset",
);
export const LIABILITY_KINDS = (Object.keys(ACCOUNT_KINDS) as AccountKind[]).filter(
  (kind) => ACCOUNT_KINDS[kind].nature === "liability",
);

