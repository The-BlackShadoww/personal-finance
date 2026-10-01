import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { RecurringService } from '../recurring/recurring.service';
import { CalculationsService } from './calculations.service';

@ApiTags('Calculations')
@ApiBearerAuth('access-token')
@Controller('calculations')
export class CalculationsController {
  constructor(
    private readonly calculationsService: CalculationsService,
    private readonly recurringService: RecurringService,
  ) {}

  @ApiOperation({
    summary: 'Get monthly financial summary',
    description:
      'Returns total income, total expenses, net savings, savings rate, ' +
      'and transaction count for a specific month.',
  })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiQuery({
    name: 'month',
    required: true,
    example: 1,
    description: '1 = January, 12 = December',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly summary',
    schema: {
      example: {
        data: {
          year: 2025,
          month: 1,
          totalIncome: 2500.0,
          totalExpense: 1800.0,
          savings: 700.0,
          savingsRate: '28.0',
          transactionCount: 24,
        },
        meta: { timestamp: '...' },
      },
    },
  })
  @Get('monthly')
  getMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.calculationsService.getMonthlySummary(user.id, year, month);
  }

  @ApiOperation({
    summary: 'Get quarterly financial summary',
    description:
      'Returns totals for the specified quarter with a monthly breakdown. ' +
      'Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.',
  })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiQuery({
    name: 'quarter',
    required: true,
    example: 1,
    description: '1 = Q1 (Jan-Mar), 4 = Q4 (Oct-Dec)',
  })
  @ApiResponse({
    status: 200,
    description: 'Quarterly summary with monthly breakdown',
  })
  @Get('quarterly')
  getQuarterlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number,
  ) {
    return this.calculationsService.getQuarterlySummary(user.id, year, quarter);
  }

  @ApiOperation({
    summary: 'Get yearly financial summary',
    description:
      'Returns annual totals with a month-by-month breakdown for all 12 months.',
  })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiResponse({
    status: 200,
    description: 'Yearly summary with monthly breakdown',
  })
  @Get('yearly')
  getYearlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.calculationsService.getYearlySummary(user.id, year);
  }

  @ApiOperation({
    summary: 'Get totals for a range of months',
    description:
      'Returns combined income, expenses, savings and transaction count for an inclusive ' +
      'range of billing months, which may span years.',
  })
  @ApiQuery({ name: 'startYear', required: true, example: 2025 })
  @ApiQuery({ name: 'startMonth', required: true, example: 1 })
  @ApiQuery({ name: 'endYear', required: true, example: 2025 })
  @ApiQuery({ name: 'endMonth', required: true, example: 12 })
  @ApiResponse({ status: 200, description: 'Range summary' })
  @Get('range')
  getRangeSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startYear', ParseIntPipe) startYear: number,
    @Query('startMonth', ParseIntPipe) startMonth: number,
    @Query('endYear', ParseIntPipe) endYear: number,
    @Query('endMonth', ParseIntPipe) endMonth: number,
  ) {
    return this.calculationsService.getRangeSummary(
      user.id,
      { year: startYear, month: startMonth },
      { year: endYear, month: endMonth },
    );
  }

  @ApiOperation({
    summary: 'Get everything the monthly dashboard shows',
    description:
      'Returns the monthly summary, yearly breakdown (plus the previous year when the ' +
      "six-month trend crosses into it), category breakdown, account summary and today's insights " +
      '(net worth, runway, health score, next best action, spending insights) in one response.',
  })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiQuery({ name: 'month', required: true, example: 1 })
  @ApiResponse({ status: 200, description: 'Dashboard overview' })
  @Get('dashboard')
  async getDashboardOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    // Opening the dashboard posts due recurring entries (salary, bills) first.
    await this.recurringService.materializeDue(user.id, user.timezone);
    return this.calculationsService.getDashboardOverview(
      user.id,
      year,
      month,
      user.timezone,
    );
  }

  @ApiOperation({
    summary: 'Get spending breakdown by category',
    description:
      'Returns total amount and transaction count grouped by category for the specified month. Results are sorted by total amount descending.',
  })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiQuery({ name: 'month', required: true, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Category breakdown',
    schema: {
      example: {
        data: [
          {
            categoryName: 'Groceries',
            color: '#dc2626',
            icon: 'shopping-cart',
            type: 'expense',
            totalCents: 45000,
            count: 8,
          },
        ],
        meta: { timestamp: '...' },
      },
    },
  })
  @Get('category-breakdown')
  getCategoryBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.calculationsService.getCategoryBreakdown(user.id, year, month);
  }
}
