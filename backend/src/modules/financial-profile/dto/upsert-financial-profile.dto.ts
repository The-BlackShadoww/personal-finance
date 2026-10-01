import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// Assumption fields always have a value, so null is rejected rather than cleared.
const unlessOmitted = ValidateIf((_object, value) => value !== undefined);

export const INCOME_STABILITIES = ['stable', 'variable'] as const;
export type IncomeStability = (typeof INCOME_STABILITIES)[number];

/**
 * Every field is optional: omit a field to keep its value. Answers (not the
 * two assumption rates) accept null to clear them.
 */
export class UpsertFinancialProfileDto {
  @ApiPropertyOptional({
    description:
      'Stable (salary) or variable (freelance, commission, seasonal). ' +
      'Variable income calls for a 6–12 month emergency fund instead of 3–6.',
    enum: INCOME_STABILITIES,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(INCOME_STABILITIES)
  incomeStability?: IncomeStability | null;

  @ApiPropertyOptional({
    description: 'People who rely on your income',
    example: 2,
    minimum: 0,
    maximum: 20,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  dependents?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasHealthInsurance?: boolean | null;

  @ApiPropertyOptional({
    description: 'Term life or equivalent cover',
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  hasLifeInsurance?: boolean | null;

  @ApiPropertyOptional({
    description:
      'Employer retirement match as a percent of salary. 0 means no match is offered.',
    example: 5,
    minimum: 0,
    maximum: 100,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  employerMatchPercent?: number | null;

  @ApiPropertyOptional({
    example: 55,
    minimum: 30,
    maximum: 90,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(90)
  retirementAgeTarget?: number | null;

  @ApiPropertyOptional({
    description:
      'Safe withdrawal rate in basis points (400 = 4%). 300–350 suits early retirement.',
    example: 400,
    minimum: 250,
    maximum: 600,
  })
  @unlessOmitted
  @IsInt()
  @Min(250)
  @Max(600)
  safeWithdrawalBps?: number;

  @ApiPropertyOptional({
    description:
      'Expected investment return after inflation, in basis points (500 = 5%).',
    example: 500,
    minimum: 0,
    maximum: 1000,
  })
  @unlessOmitted
  @IsInt()
  @Min(0)
  @Max(1000)
  expectedRealReturnBps?: number;
}
