import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { RecurringService } from '../recurring/recurring.service';
import { NetWorthQueryDto } from './dto/insights-query.dto';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@ApiBearerAuth('access-token')
@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly recurringService: RecurringService,
  ) {}

  @ApiOperation({
    summary: 'Get the financial health overview',
    description:
      'One response for the Insights page: net worth (with a month-end history), money available ' +
      'to spend, runway in months, savings and investing rates, the health score with every ' +
      "metric's value, target, score and tip, the next best action from the money waterfall, up to " +
      'three spending insights, and investment accounts whose value needs updating. Ratios use ' +
      'take-home income, which is stricter than the usual gross-income rules. Educational ' +
      'guidance, not individual financial advice.',
  })
  @ApiResponse({ status: 200, description: 'Insights overview' })
  @Get()
  async getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NetWorthQueryDto,
  ) {
    await this.recurringService.materializeDue(user.id, user.timezone);
    return this.insightsService.getOverview(
      user.id,
      user.timezone,
      query.months ?? 24,
    );
  }

  @ApiOperation({
    summary: 'Get month-end net worth',
    description:
      'Assets minus liabilities at the end of each month, the last point being today. Investment, ' +
      'retirement and property accounts use their latest valuation (plus money moved since) where entered.',
  })
  @ApiResponse({ status: 200, description: 'Net worth series' })
  @Get('net-worth')
  getNetWorth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NetWorthQueryDto,
  ) {
    return this.insightsService.getNetWorthSeries(
      user.id,
      user.timezone,
      query.months ?? 24,
    );
  }
}
