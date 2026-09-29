'use client';

import { Check } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils/cn';

// Preset colors — cover common use cases while keeping the UI clean.
export const PRESET_COLORS = [
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#65a30d',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0284c7',
  '#6b7280',
  '#1e293b',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
        {PRESET_COLORS.map((color) => {
          const selected = value.toLowerCase() === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              onClick={() => onChange(color)}
              className={cn(
                'relative grid h-7 w-7 place-items-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95',
                selected && 'ring-2 ring-offset-2 ring-offset-[var(--ds-surface)]',
              )}
              style={{ backgroundColor: color, ['--tw-ring-color' as string]: color }}
              title={color}
            >
              {selected ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
                  <Check size={12} weight="bold" className="text-white" />
                </motion.span>
              ) : null}
            </button>
          );
        })}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-3 rounded-[6px] border border-line py-1.5 pl-1.5 pr-3 text-[13px] text-muted transition-colors hover:border-line-strong">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded-[4px] border-0 bg-transparent p-0"
          title="Custom color"
        />
        <span className="font-mono text-foreground">{value}</span>
        <span>Custom</span>
      </label>
    </div>
  );
}
