import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class UpsertBudgetDto {
  @ApiProperty({
    description: 'The year this budget applies to',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({
    description: 'The month this budget applies to (1 = January, 12 = December)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    description: 'Budget cap in dollars. Stored internally as cents.',
    example: 500.00,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiPropertyOptional({
    description: 'UUID of a specific category to budget for. Omit for a global monthly budget.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ description: 'Carry leftovers (or overspending) into next month' })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;
}
