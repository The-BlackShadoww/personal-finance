import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';
import {
  ACCOUNT_KINDS,
  ASSET_CLASSES,
  type AccountKind,
  type AssetClass,
} from '../account-kinds';

export class CreateAccountDto {
  @ApiProperty({ example: 'City Bank salary account', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description:
      'Determines whether the account is an asset (money you own) or a liability ' +
      '(credit_card, loan: money you owe). Can only change to a kind of the same nature.',
    enum: ACCOUNT_KINDS,
    example: 'bank',
  })
  @IsEnum(ACCOUNT_KINDS)
  kind!: AccountKind;

  @ApiPropertyOptional({
    description:
      'Balance before the first recorded transaction, in major units. For credit cards and ' +
      'loans, the amount owed. Negative is allowed (e.g. an overdrawn account).',
    example: 25000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-MAX_AMOUNT)
  @Max(MAX_AMOUNT)
  openingBalance?: number;

  @ApiPropertyOptional({
    description:
      'Can be spent within days without penalty; counts toward runway and the emergency fund. ' +
      'Defaults by kind. Always false for liabilities.',
  })
  @IsOptional()
  @IsBoolean()
  isLiquid?: boolean;

  @ApiPropertyOptional({
    description: 'Make this the account new transactions default to.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description:
      'Annual interest rate in percent: APR for debts, yield for savings.',
    example: 24.5,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @ApiPropertyOptional({
    description: 'Debts: minimum monthly payment, major units.',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  minimumPayment?: number | null;

  @ApiPropertyOptional({
    description: 'Credit cards: credit limit, major units.',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  creditLimit?: number | null;

  @ApiPropertyOptional({ enum: ASSET_CLASSES, nullable: true })
  @IsOptional()
  @IsEnum(ASSET_CLASSES)
  assetClass?: AssetClass | null;

  @ApiPropertyOptional({
    description: 'Investments: annual fund fee in percent (e.g. 0.2).',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  expenseRatio?: number | null;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'landmark', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({
    description: 'Include archived accounts',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}
