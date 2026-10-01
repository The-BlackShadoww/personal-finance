import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsBoolean,
  IsInt, IsHexColor, MinLength, MaxLength, Min
} from 'class-validator';

export type CategoryType = 'income' | 'expense';

export const CATEGORY_TAGS = ['housing', 'debt_interest', 'insurance', 'education', 'health'] as const;
export type CategoryTag = (typeof CATEGORY_TAGS)[number];

export const INCOME_KINDS = ['active', 'passive', 'portfolio'] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name. Must be unique per user per type.',
    example: 'Groceries',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Whether this is an income or expense category. Cannot be changed after creation.',
    enum: ['income', 'expense'],
    example: 'expense',
  })
  @IsEnum(['income', 'expense'])
  type!: CategoryType;

  @ApiPropertyOptional({
    description: 'Hex color code for the category. Used for UI display.',
    example: '#dc2626',
    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier string. Must be a valid lucide-react icon name in kebab-case.',
    example: 'shopping-cart',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Sort order for display. Lower numbers appear first.',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Expense categories only. A need rather than a want (rent, groceries, utilities). ' +
      'Used for 50/30/20 splits, emergency-fund targets and runway.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  essential?: boolean;

  @ApiPropertyOptional({
    description: 'Expense categories only. Roughly the same amount every month (rent, subscriptions).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  fixed?: boolean;

  @ApiPropertyOptional({
    description: 'Expense categories only. Marks a category that feeds a specific financial ratio.',
    enum: CATEGORY_TAGS,
    nullable: true,
    example: 'housing',
  })
  @IsOptional()
  @IsEnum(CATEGORY_TAGS)
  tag?: CategoryTag | null;

  @ApiPropertyOptional({
    description: 'Income categories only. Active = work, passive = rent/royalties, portfolio = dividends/interest.',
    enum: INCOME_KINDS,
    nullable: true,
    example: 'active',
  })
  @IsOptional()
  @IsEnum(INCOME_KINDS)
  incomeKind?: IncomeKind | null;
}

export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['type'] as const),
) {}
