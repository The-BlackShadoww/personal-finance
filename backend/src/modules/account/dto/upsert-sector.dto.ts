import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class UpsertSectorDto {
  @ApiProperty({ example: 'Emergency Fund', minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 99 })
  @IsInt() @Min(1) @Max(99)
  percentage!: number;

  @ApiPropertyOptional({ example: '#dc2626' })
  @IsOptional() @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'shield' })
  @IsOptional() @IsString() @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 5000, description: 'Optional savings goal in whole dollars.' })
  @IsOptional() @IsInt() @Min(1) @Max(MAX_AMOUNT)
  targetAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}
