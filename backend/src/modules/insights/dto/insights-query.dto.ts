import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class NetWorthQueryDto {
  @ApiPropertyOptional({
    description: 'Months of month-end net worth',
    default: 24,
    minimum: 2,
    maximum: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(120)
  months?: number;
}
