import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class SetupAccountDto {
  @ApiProperty({ description: 'Initial account balance in whole dollars.', example: 22500, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  initialBalance!: number;

  @ApiPropertyOptional({ description: 'Low-balance warning threshold in whole dollars.', example: 5000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  lowBalanceThreshold?: number;
}
