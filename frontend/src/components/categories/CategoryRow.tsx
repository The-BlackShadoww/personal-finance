'use client';

import { Lock, PencilSimple, Trash } from '@phosphor-icons/react';
import { CategoryIcon } from './IconPicker';
import { Category } from '../../lib/api/categories';
import { cn } from '../../lib/utils/cn';

interface CategoryRowProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  isDeleting: boolean;
}

export function CategoryRow({ category, onEdit, onDelete, isDeleting }: CategoryRowProps) {
  return (
    <div className="group flex items-center gap-3.5 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-surface-2">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]"
        style={{ backgroundColor: `color-mix(in srgb, ${category.color} 14%, transparent)`, color: category.color }}
      >
        <CategoryIcon name={category.icon} size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] text-foreground">{category.name}</span>
          {category.isDefault && (
            <span className="tag bg-surface-3 text-muted">
              <Lock size={9} weight="bold" />
              Default
            </span>
          )}
        </div>
        <span className="text-[12px] capitalize text-muted">{category.type}</span>
      </div>

      <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(category)}
          aria-label={`Edit ${category.name}`}
          title="Edit category"
          className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <PencilSimple size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(category)}
          disabled={category.isDefault || isDeleting}
          aria-label={`Delete ${category.name}`}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-[6px] transition-colors',
            category.isDefault ? 'cursor-not-allowed text-ghost' : 'text-muted hover:bg-red-bg hover:text-red-fg',
          )}
          title={category.isDefault ? 'Default categories cannot be deleted' : 'Delete category'}
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
