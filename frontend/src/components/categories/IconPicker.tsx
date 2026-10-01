'use client';

import {
  Airplane,
  Baby,
  Bank,
  Barbell,
  Book,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  DeviceMobile,
  Dog,
  DotsThree,
  FilmSlate,
  ForkKnife,
  Gift,
  GraduationCap,
  Heart,
  House,
  Laptop,
  Lightning,
  Money,
  MusicNotes,
  PiggyBank,
  PlusCircle,
  Shield,
  ShoppingCart,
  Stethoscope,
  Tag,
  Television,
  TrendUp,
  Wallet,
  WifiHigh,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';
import { cn } from '../../lib/utils/cn';

// Icon identifiers are stored as strings on categories and sectors. The keys
// are unchanged so existing records keep rendering; only the artwork differs.
export const SUPPORTED_ICONS = [
  'briefcase', 'laptop', 'trending-up', 'plus-circle',
  'shopping-cart', 'home', 'zap', 'car', 'film',
  'heart', 'more-horizontal', 'tag', 'coffee', 'utensils',
  'book', 'plane', 'gift', 'music', 'dumbbell',
  'baby', 'dog', 'graduation-cap', 'stethoscope', 'wrench',
  'smartphone', 'tv', 'wifi', 'shield', 'piggy-bank', 'credit-card',
] as const;

export type IconName = typeof SUPPORTED_ICONS[number];

const ICONS: Record<string, Icon> = {
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendUp,
  'plus-circle': PlusCircle,
  'shopping-cart': ShoppingCart,
  home: House,
  zap: Lightning,
  car: Car,
  film: FilmSlate,
  heart: Heart,
  'more-horizontal': DotsThree,
  tag: Tag,
  coffee: Coffee,
  utensils: ForkKnife,
  book: Book,
  plane: Airplane,
  gift: Gift,
  music: MusicNotes,
  dumbbell: Barbell,
  baby: Baby,
  dog: Dog,
  'graduation-cap': GraduationCap,
  stethoscope: Stethoscope,
  wrench: Wrench,
  smartphone: DeviceMobile,
  tv: Television,
  wifi: WifiHigh,
  shield: Shield,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  banknote: Money,
  wallet: Wallet,
  landmark: Bank,
};

/** Renders a category/sector icon by its stored string name. */
export function CategoryIcon({ name, size = 18, className }: { name?: string | null; size?: number; className?: string }) {
  const Component = (name && ICONS[name]) || Tag;
  return <Component size={size} weight="bold" className={className} aria-hidden="true" />;
}

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10" role="radiogroup" aria-label="Icon">
      {SUPPORTED_ICONS.map((icon) => {
        const selected = value === icon;
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={icon.replace(/-/g, ' ')}
            onClick={() => onChange(icon)}
            title={icon.replace(/-/g, ' ')}
            className={cn(
              'grid aspect-square place-items-center rounded-[6px] border transition-all duration-150 active:scale-95',
              selected
                ? 'border-strong bg-strong text-strong-foreground'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
            )}
          >
            <CategoryIcon name={icon} size={16} />
          </button>
        );
      })}
    </div>
  );
}
