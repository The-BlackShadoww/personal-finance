import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_AMOUNT } from '../../../common/money/money.constants';

export class UpsertValuationDto {
  @ApiProperty({
    description:
      'The day the value applies to. One valuation per day; a second replaces the first.',
    example: '2026-09-30',
  })
  @IsISO8601({ strict: true })
  date!: string;

  @ApiProperty({
    description: 'What the account was worth that day, in major units.',
    example: 152000.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  value!: number;

  @ApiPropertyOptional({
    example: 'From the September statement',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
