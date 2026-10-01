import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ApiErrorResponse } from '../../common/swagger/api-response.swagger';
import { UpsertFinancialProfileDto } from './dto/upsert-financial-profile.dto';
import { FinancialProfileService } from './financial-profile.service';

@ApiTags('Financial profile')
@ApiBearerAuth('access-token')
@Controller('profile/financial')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
  ) {}

  @ApiOperation({
    summary: 'Get the financial profile',
    description:
      'Answers that tune advice (income stability, dependents, insurance, employer match, ' +
      'retirement assumptions). Unanswered questions are null. Also returns an income-stability ' +
      'assessment from the last six complete months of transactions.',
  })
  @ApiResponse({ status: 200, description: 'Financial profile' })
  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.financialProfileService.get(user.id, user.timezone);
  }

  @ApiOperation({
    summary: 'Create or update the financial profile',
    description: 'Omitted fields keep their value; null clears an answer.',
  })
  @ApiBody({ type: UpsertFinancialProfileDto })
  @ApiResponse({ status: 200, description: 'Updated financial profile' })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ApiErrorResponse,
  })
  @Put()
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertFinancialProfileDto,
  ) {
    return this.financialProfileService.upsert(user.id, user.timezone, dto);
  }
}
