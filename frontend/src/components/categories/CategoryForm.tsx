'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CategoryIcon, IconPicker } from './IconPicker';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';
import { Category, CategoryClassification, CategoryTag, IncomeKind } from '../../lib/api/categories';
import { ChoiceGroup } from '@/components/settings/ui';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from "@/components/ui/Select";

const TAG_OPTIONS: Array<{ value: CategoryTag | ''; label: string }> = [
  { value: '', label: 'Nothing specific' },
  { value: 'housing', label: 'Housing (rent, mortgage)' },
  { value: 'debt_interest', label: 'Debt interest & fees' },
  { value: 'insurance', label: 'Insurance premiums' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
];

const INCOME_KIND_OPTIONS: Array<{ value: IncomeKind; label: string }> = [
  { value: 'active', label: 'Active — from work' },
  { value: 'passive', label: 'Passive — rent, royalties' },
  { value: 'portfolio', label: 'Portfolio — dividends, interest' },
];

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color'),
  icon: z.string().min(1, 'Please select an icon'),
  essential: z.boolean(),
  fixed: z.boolean(),
  tag: z.enum(['housing', 'debt_interest', 'insurance', 'education', 'health']).nullable(),
  incomeKind: z.enum(['active', 'passive', 'portfolio']).nullable(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export type CategoryFormSubmitValues = Pick<CategoryFormValues, 'name' | 'type' | 'color' | 'icon'> &
  CategoryClassification;

interface CategoryFormProps {
  initialData?: Category; // provided → edit mode; undefined → create mode
  onSubmit: (values: CategoryFormSubmitValues) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function CategoryForm({ initialData, onSubmit, onCancel, isLoading }: CategoryFormProps) {
  const isEditing = Boolean(initialData);

  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<CategoryFormValues>({
      resolver: zodResolver(categorySchema),
      defaultValues: {
        name: initialData?.name ?? '',
        type: initialData?.type ?? 'expense',
        color: initialData?.color ?? PRESET_COLORS[0],
        icon: initialData?.icon ?? 'tag',
        essential: initialData?.essential ?? false,
        fixed: initialData?.fixed ?? false,
        tag: initialData?.tag ?? null,
        incomeKind: initialData?.incomeKind ?? null,
      },
    });

  const selectedColor = watch('color');
  const selectedIcon = watch('icon');
  const selectedType = watch('type');
  const name = watch('name');
  const essential = watch('essential');
  const tag = watch('tag');
  const incomeKind = watch('incomeKind');

  // Spending flags and income kind are mutually exclusive; the API rejects
  // the wrong set for a category's type.
  function submit({ essential, fixed, tag, incomeKind, ...base }: CategoryFormValues) {
    return onSubmit(base.type === 'expense' ? { ...base, essential, fixed, tag } : { ...base, incomeKind });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="category-name">Name</label>
          <input
            id="category-name"
            {...register('name')}
            placeholder="Groceries"
            aria-invalid={errors.name ? 'true' : 'false'}
            className="field"
          />
          {errors.name && <p className="mt-1.5 text-[12px] text-red-fg">{errors.name.message}</p>}
        </div>
        <div>
          <span className="label">
            Type
            {isEditing && <span className="ml-1.5 text-[12px] text-faint">locked</span>}
          </span>
          <div className={isEditing ? 'pointer-events-none opacity-60' : undefined}>
            <SegmentedControl
              label="Category type"
              value={selectedType}
              onChange={(type) => !isEditing && setValue('type', type)}
              options={[
                { value: 'income', label: 'Income', disabled: isEditing },
                { value: 'expense', label: 'Expense', disabled: isEditing },
              ]}
            />
          </div>
        </div>
      </div>

      {selectedType === 'expense' ? (
        <div className="space-y-5 rounded-[10px] border border-line px-4 py-4">
          <div>
            <span className="label">Need or want?</span>
            <ChoiceGroup
              label="Need or want"
              value={essential}
              onChange={(value) => setValue('essential', value)}
              options={[
                { value: true, label: 'Need — hard to cut' },
                { value: false, label: 'Want — optional' },
              ]}
            />
            <p className="mt-1.5 text-[12px] text-muted">Needs size your emergency fund and the 50/30/20 split.</p>
          </div>
          <label className="flex items-start gap-2.5 text-[13px] text-foreground">
            <input type="checkbox" {...register('fixed')} className="mt-0.5 h-4 w-4 accent-[var(--ds-foreground)]" />
            <span>
              Roughly the same every month
              <span className="block text-[12px] text-muted">Rent, subscriptions, loan interest.</span>
            </span>
          </label>
          <div>
            <label className="label" htmlFor="category-tag">Counts toward</label>
            <Select
              id="category-tag"
              className="field"
              value={tag ?? ''}
              onChange={(event) => setValue('tag', (event.target.value || null) as CategoryTag | null)}
            >
              {TAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : (
        <div className="rounded-[10px] border border-line px-4 py-4">
          <span className="label">Kind of income</span>
          <ChoiceGroup
            label="Kind of income"
            value={incomeKind}
            onChange={(value) => setValue('incomeKind', value)}
            options={INCOME_KIND_OPTIONS}
          />
          <p className="mt-1.5 text-[12px] text-muted">
            Passive and portfolio income show how close you are to not needing a paycheck.
          </p>
        </div>
      )}

      <div>
        <span className="label">Color</span>
        <ColorPicker value={selectedColor} onChange={(color) => setValue('color', color, { shouldValidate: true })} />
        {errors.color && <p className="mt-1.5 text-[12px] text-red-fg">{errors.color.message}</p>}
      </div>

      <div>
        <span className="label">Icon</span>
        <IconPicker value={selectedIcon} onChange={(icon) => setValue('icon', icon, { shouldValidate: true })} />
        {errors.icon && <p className="mt-1.5 text-[12px] text-red-fg">{errors.icon.message}</p>}
      </div>

      <div className="flex items-center gap-3 rounded-[8px] border border-dashed border-line-strong px-4 py-3">
        <span className="text-[12px] text-muted">Preview</span>
        <span
          className="inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[13px]"
          style={{ backgroundColor: `color-mix(in srgb, ${selectedColor} 14%, transparent)`, color: selectedColor }}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--ds-surface)]">
            <CategoryIcon name={selectedIcon} size={11} />
          </span>
          {name || 'Category name'}
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving…' : isEditing ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}
