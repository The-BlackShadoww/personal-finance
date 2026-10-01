export const ACCOUNT_KINDS = [
  'cash',
  'bank',
  'mobile_wallet',
  'savings',
  'investment',
  'retirement',
  'property',
  'credit_card',
  'loan',
  'other',
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export type AccountNature = 'asset' | 'liability';

export const ASSET_CLASSES = [
  'equity',
  'bond',
  'cash',
  'real_estate',
  'gold',
  'mixed',
  'other',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

type KindMeta = {
  nature: AccountNature;
  /** Default for "can be spent within days without penalty". */
  liquid: boolean;
  icon: string;
};

export const ACCOUNT_KIND_META: Record<AccountKind, KindMeta> = {
  cash: { nature: 'asset', liquid: true, icon: 'banknote' },
  bank: { nature: 'asset', liquid: true, icon: 'landmark' },
  mobile_wallet: { nature: 'asset', liquid: true, icon: 'smartphone' },
  savings: { nature: 'asset', liquid: true, icon: 'piggy-bank' },
  investment: { nature: 'asset', liquid: false, icon: 'trending-up' },
  retirement: { nature: 'asset', liquid: false, icon: 'shield' },
  property: { nature: 'asset', liquid: false, icon: 'home' },
  credit_card: { nature: 'liability', liquid: false, icon: 'credit-card' },
  loan: { nature: 'liability', liquid: false, icon: 'landmark' },
  other: { nature: 'asset', liquid: false, icon: 'wallet' },
};

/** Where a transfer from a spending account went, for "where did my surplus go". */
export type TransferPurpose = 'saving' | 'investing' | 'debt' | 'other';

export function transferPurpose(
  from: { nature: AccountNature },
  to: { kind: AccountKind; nature: AccountNature },
): TransferPurpose {
  // Borrowing (liability → asset) or moving between liabilities is not a use
  // of surplus.
  if (from.nature !== 'asset') return 'other';
  if (to.nature === 'liability') return 'debt';
  if (to.kind === 'savings') return 'saving';
  if (to.kind === 'investment' || to.kind === 'retirement') return 'investing';
  return 'other';
}
