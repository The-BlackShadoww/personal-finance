import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export enum TransactionType {
  Income = 'income',
  Expense = 'expense',
  /** Money moved between two of the user's accounts; not income or spending. */
  Transfer = 'transfer',
}

export class CreateTransactionDto {
  @ApiProperty({
    description:
      'income, expense, or transfer (money moved between your own accounts, e.g. into savings or onto a credit card)',
    enum: TransactionType,
    example: 'expense',
  })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    description: 'Transaction amount in dollars. Stored internally as cents.',
    example: 49.99,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({
    description:
      'The date money physically changed hands (received or paid). This is informational only — it does NOT determine which month/year the transaction appears in on the dashboard. Use transactionMonth and transactionYear for period attribution.',
    example: '2025-01-15',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description:
      'The month this transaction belongs to (billing period). 1 = January, 12 = December. This determines which month the transaction appears in on the dashboard and reports — independent of the date field.',
    example: 7,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  transactionMonth!: number;

  @ApiProperty({
    description:
      'The year this transaction belongs to (billing period). This determines which year the transaction appears in on the dashboard.',
    example: 2026,
    minimum: 2000,
    maximum: 2100,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  transactionYear!: number;

  @ApiPropertyOptional({
    description:
      'Income and expense only (required for them): a category of the same type owned by the user. ' +
      'Must be omitted for transfers.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Income/expense: the account money arrived in or left from. Transfer: the source account. ' +
      "Defaults to the user's default account.",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Transfers only (required for them): the destination account.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  counterAccountId?: string;

  @ApiPropertyOptional({
    description: 'Optional note or description for this transaction',
    example: 'Monthly grocery run at Agora',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
