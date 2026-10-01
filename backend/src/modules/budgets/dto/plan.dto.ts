import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export const BUDGET_METHODS = [
  'zero_based',
  'fifty_thirty_twenty',
  'seventy_twenty_ten',
  'category_caps',
] as const;

export class PeriodDto {
  @ApiProperty({ example: 2026, minimum: 2020, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class UpsertPlanDto extends PeriodDto {
  @ApiPropertyOptional({
    description:
      'zero_based: give every unit of income a job. fifty_thirty_twenty: needs ≤ 50%, wants ≤ 30%, ' +
      'saving ≥ 20%. seventy_twenty_ten: living ≤ 70%, saving ≥ 20%, debt and giving 10%. ' +
      'category_caps: limits per category only.',
    enum: BUDGET_METHODS,
  })
  @IsOptional()
  @IsEnum(BUDGET_METHODS)
  method?: (typeof BUDGET_METHODS)[number];

  @ApiPropertyOptional({
    description:
      'Expected income for the month in major units; null to use the suggestion',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  expectedIncome?: number | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class BudgetItemDto {
  @ApiProperty({ description: 'Expense category UUID' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    description: 'Budget in major units; null removes the budget',
    nullable: true,
  })
  // Required: send null explicitly to remove, so a missing field never deletes.
  @ValidateIf((_item, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  amount!: number | null;

  @ApiPropertyOptional({
    description: 'Carry leftovers (or overspending) into next month',
  })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;
}

export class BulkBudgetsDto extends PeriodDto {
  @ApiProperty({ type: [BudgetItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  items!: BudgetItemDto[];
}
