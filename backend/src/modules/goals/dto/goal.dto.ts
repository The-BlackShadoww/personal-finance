import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export const CREATABLE_GOAL_KINDS = ['sinking', 'long_term', 'custom'] as const;
export const FUNDING_RULES = [
  'percent_of_income',
  'fixed_monthly',
  'manual',
] as const;
export const WITHDRAWAL_REASONS = [
  'emergency',
  'planned_purchase',
  'rebalancing',
  'other',
] as const;

export type FundingRuleValue = (typeof FUNDING_RULES)[number];
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

export class CreateGoalDto {
  @ApiProperty({ example: 'New laptop', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description:
      'sinking: a known future cost with a date; long_term: a large goal years away; custom: anything else. ' +
      'Every user has exactly one emergency goal, created automatically.',
    enum: CREATABLE_GOAL_KINDS,
  })
  @IsIn(CREATABLE_GOAL_KINDS)
  kind!: (typeof CREATABLE_GOAL_KINDS)[number];

  @ApiProperty({ description: 'The asset account the money is kept in' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({
    description: 'Target in major units',
    example: 120000,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  targetAmount?: number | null;

  @ApiPropertyOptional({ example: '2027-03-31', nullable: true })
  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @ApiPropertyOptional({
    description: 'Sinking funds: the date moves on a year once it passes',
  })
  @IsOptional()
  @IsBoolean()
  repeatsYearly?: boolean;

  @ApiPropertyOptional({
    description:
      'Sinking funds: expenses in this category can be paid from the goal',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description:
      'percent_of_income: set aside fundingPercent of every income. fixed_monthly: set aside ' +
      "fundingAmount from each billing month's income. manual: only when you add money.",
    enum: FUNDING_RULES,
  })
  @IsOptional()
  @IsEnum(FUNDING_RULES)
  fundingRule?: FundingRuleValue;

  @ApiPropertyOptional({
    description: 'Percent of each income, e.g. 10',
    example: 10,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  fundingPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Amount per month in major units',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  fundingAmount?: number | null;

  @ApiPropertyOptional({ example: '#16a34a' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'laptop', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}

/** Kind cannot change; the emergency goal additionally accepts targetMonths. */
export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @ApiPropertyOptional({
    description:
      'Emergency goal only: months of essential spending to hold (3–12). Null follows your financial profile.',
    minimum: 3,
    maximum: 12,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(12)
  targetMonths?: number | null;
}

export class ContributeDto {
  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiPropertyOptional({
    description:
      "Where the money comes from. If it is not the goal's account, a transfer moves it there. " +
      "Defaults to the goal's account (earmarking money already in it).",
  })
  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class WithdrawDto {
  @ApiProperty({ example: 2000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({
    description:
      'Why the money is leaving the goal. Withdrawals ask for a reason on purpose.',
    enum: WITHDRAWAL_REASONS,
  })
  @IsEnum(WITHDRAWAL_REASONS)
  reason!: WithdrawalReason;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ReorderGoalsDto {
  @ApiProperty({
    description: 'Goal ids in the order income should be shared out',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class ListGoalsQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}
