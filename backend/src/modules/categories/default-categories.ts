import type { CategoryTag, CategoryType, IncomeKind } from './dto/category.dto';

type DefaultCategory = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  essential?: boolean;
  fixed?: boolean;
  tag?: CategoryTag;
  incomeKind?: IncomeKind;
};

/**
 * Categories every new user starts with. The essential/fixed/tag flags let
 * ratio-based advice (emergency fund, housing cost, 50/30/20) work from day one.
 *
 * Money moved into savings or investments is not income or spending, so there
 * is deliberately no "Savings" or "Investing" expense category; "Investment
 * returns" covers dividends and interest only.
 *
 * Migration 0005 mirrors this list for existing users; keep them in sync.
 */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    name: 'Salary',
    type: 'income',
    color: '#16a34a',
    icon: 'briefcase',
    incomeKind: 'active',
  },
  {
    name: 'Freelance',
    type: 'income',
    color: '#2563eb',
    icon: 'laptop',
    incomeKind: 'active',
  },
  {
    name: 'Investment returns',
    type: 'income',
    color: '#7c3aed',
    icon: 'trending-up',
    incomeKind: 'portfolio',
  },
  {
    name: 'Other Income',
    type: 'income',
    color: '#0891b2',
    icon: 'plus-circle',
  },

  {
    name: 'Groceries',
    type: 'expense',
    color: '#dc2626',
    icon: 'shopping-cart',
    essential: true,
  },
  {
    name: 'Rent',
    type: 'expense',
    color: '#ea580c',
    icon: 'home',
    essential: true,
    fixed: true,
    tag: 'housing',
  },
  {
    name: 'Utilities',
    type: 'expense',
    color: '#d97706',
    icon: 'zap',
    essential: true,
  },
  {
    name: 'Transport',
    type: 'expense',
    color: '#65a30d',
    icon: 'car',
    essential: true,
  },
  {
    name: 'Health',
    type: 'expense',
    color: '#db2777',
    icon: 'heart',
    essential: true,
    tag: 'health',
  },
  {
    name: 'Insurance',
    type: 'expense',
    color: '#0f766e',
    icon: 'shield',
    essential: true,
    fixed: true,
    tag: 'insurance',
  },
  {
    name: 'Debt interest & fees',
    type: 'expense',
    color: '#b91c1c',
    icon: 'credit-card',
    essential: true,
    tag: 'debt_interest',
  },
  {
    name: 'Education',
    type: 'expense',
    color: '#4f46e5',
    icon: 'graduation-cap',
    essential: true,
    tag: 'education',
  },
  { name: 'Dining out', type: 'expense', color: '#c2410c', icon: 'utensils' },
  {
    name: 'Subscriptions',
    type: 'expense',
    color: '#9333ea',
    icon: 'tv',
    fixed: true,
  },
  { name: 'Entertainment', type: 'expense', color: '#0284c7', icon: 'film' },
  {
    name: 'Other Expense',
    type: 'expense',
    color: '#6b7280',
    icon: 'more-horizontal',
  },
];
