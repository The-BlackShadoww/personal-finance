import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponse } from '../../common/swagger/api-response.swagger';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SetTargetAllocationDto } from './dto/target-allocation.dto';
import { WealthService } from './wealth.service';

@ApiTags('Wealth')
@ApiBearerAuth('access-token')
@Controller('wealth')
export class WealthController {
  constructor(private readonly wealthService: WealthService) {}

  @ApiOperation({
    summary: 'Get debt, FI, investment and income data',
    description:
      'Inputs for the debt payoff planner (debts with balance, APR and minimum payment) and the ' +
      'financial-independence calculator (spending, invested money, monthly investing, assumptions), ' +
      'plus investment tracking — return over the last year (Modified Dietz from entered values), ' +
      'allocation against the target mix with rebalancing advice, fees and 20-year fee drag, months ' +
      'with contributions — and income tracking: by kind, sources, concentration, passive coverage ' +
      'and year-over-year growth. Educational; no product recommendations.',
  })
  @ApiResponse({ status: 200, description: 'Wealth overview' })
  @Get()
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.wealthService.getOverview(user.id, user.timezone);
  }

  @ApiOperation({
    summary: 'Set the target asset mix',
    description:
      'Replaces the whole target allocation. Shares must add up to 100%; an empty list clears it.',
  })
  @ApiBody({ type: SetTargetAllocationDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Put('target-allocation')
  setTargets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetTargetAllocationDto,
  ) {
    return this.wealthService.setTargets(user.id, dto);
  }
}
