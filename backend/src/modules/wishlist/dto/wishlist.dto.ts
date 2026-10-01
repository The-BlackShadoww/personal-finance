import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class CreateWishlistItemDto {
  @ApiProperty({ example: 'Noise-cancelling headphones', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Price in major units', example: 18500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiPropertyOptional({ example: 'https://example.com/item' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url?: string;

  @ApiPropertyOptional({
    description: 'Expense category it would be recorded in',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export const WISHLIST_DECISIONS = ['pending', 'bought', 'skipped'] as const;
export type WishlistDecision = (typeof WISHLIST_DECISIONS)[number];

export class DecideWishlistItemDto {
  @ApiProperty({
    enum: WISHLIST_DECISIONS,
    description:
      "'bought' or 'skipped' once the cooling-off time has passed ('skipped' is allowed any time); " +
      "'pending' undoes a decision.",
  })
  @IsIn(WISHLIST_DECISIONS)
  decision!: WishlistDecision;

  @ApiPropertyOptional({
    description: 'The expense recorded for a bought item',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;
}
