import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class SetupAccountDto {
  @ApiProperty({ description: 'Initial account balance in major units, up to 2 decimals.', example: 22500.25, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  initialBalance!: number;

  @ApiPropertyOptional({ description: 'Low-balance warning threshold in major units, up to 2 decimals.', example: 5000, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  lowBalanceThreshold?: number;
}
