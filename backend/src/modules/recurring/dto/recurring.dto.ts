import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
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
import { TransactionType } from '../../transactions/dto/create-transaction.dto';

export const FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export class CreateRecurringDto {
  @ApiProperty({ example: 'Salary', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ example: 80000, description: 'Amount in major units' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Defaults to the default account; the source for transfers',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Transfers only: the destination account',
  })
  @IsOptional()
  @IsUUID()
  counterAccountId?: string;

  @ApiPropertyOptional({ description: 'Income and expense only' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ enum: FREQUENCIES })
  @IsEnum(FREQUENCIES)
  frequency!: (typeof FREQUENCIES)[number];

  @ApiProperty({
    description:
      'The first occurrence. Later ones keep its weekday (weekly) or day of month, clamped to shorter months. ' +
      'Occurrences before today are not posted.',
    example: '2026-10-25',
  })
  @IsDateString()
  anchorDate!: string;

  @ApiPropertyOptional({ example: '2027-12-31', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Billing month relative to the date: -1 for rent paid on the 1st for last month, +1 for salary paid early',
    minimum: -1,
    maximum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(1)
  periodOffsetMonths?: number;

  @ApiPropertyOptional({
    description:
      'Post automatically when due; otherwise it waits in "Due" for confirmation',
  })
  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  @ApiPropertyOptional({
    description: 'Expenses only: count toward subscription totals',
  })
  @IsOptional()
  @IsBoolean()
  isSubscription?: boolean;

  @ApiPropertyOptional({
    description:
      'Make an existing entry the first occurrence ("Make recurring"); anchorDate should be its date',
  })
  @IsOptional()
  @IsUUID()
  fromTransactionId?: string;
}

export class UpdateRecurringDto extends PartialType(
  OmitType(CreateRecurringDto, ['fromTransactionId'] as const),
) {}

export class ConfirmOccurrenceDto {
  @ApiPropertyOptional({
    description:
      'Override the amount for this occurrence (e.g. a variable bill)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount?: number;
}
