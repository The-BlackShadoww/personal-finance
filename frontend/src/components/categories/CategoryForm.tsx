'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CategoryIcon, IconPicker } from './IconPicker';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';
import { Category } from '../../lib/api/categories';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color'),
  icon: z.string().min(1, 'Please select an icon'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  initialData?: Category; // provided → edit mode; undefined → create mode
  onSubmit: (values: CategoryFormValues) => Promise<void>;
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
      },
    });

  const selectedColor = watch('color');
  const selectedIcon = watch('icon');
  const selectedType = watch('type');
  const name = watch('name');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
