import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { WorthIt } from '../calc/review';

export class CompleteReviewDto {
  @ApiPropertyOptional({
    description: "Ratings by category id: 'yes', 'meh' or 'no'.",
    example: { '9b1d…': 'no' },
  })
  @IsOptional()
  @IsObject()
  worthIt?: Record<string, WorthIt>;

  @ApiPropertyOptional({
    description: 'The one thing to do next month.',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  action?: string;

  @ApiPropertyOptional({
    description: "Whether last month's commitment was done.",
  })
  @IsOptional()
  @IsBoolean()
  previousActionDone?: boolean;
}
