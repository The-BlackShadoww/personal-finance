import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ApiErrorResponse } from '../../common/swagger/api-response.swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Download transactions as CSV', description: 'Generates a CSV for the selected billing-period range.' })
  @ApiQuery({ name: 'startYear', required: true, example: 2026 })
  @ApiQuery({ name: 'startMonth', required: true, example: 7 })
  @ApiQuery({ name: 'endYear', required: true, example: 2026 })
  @ApiQuery({ name: 'endMonth', required: true, example: 7 })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Get('csv')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3600 } })
  async downloadCsv(@Query('startYear') startYear: string, @Query('startMonth') startMonth: string, @Query('endYear') endYear: string, @Query('endMonth') endMonth: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const period = this.parsePeriod(startYear, startMonth, endYear, endMonth);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    (await this.reportsService.generateCsv(user.id, period, user)).pipe(res);
  }

  @ApiOperation({ summary: 'Download financial report as PDF', description: 'Generates a formatted PDF for the selected billing-period range.' })
  @ApiQuery({ name: 'startYear', required: true, example: 2026 })
  @ApiQuery({ name: 'startMonth', required: true, example: 7 })
  @ApiQuery({ name: 'endYear', required: true, example: 2026 })
  @ApiQuery({ name: 'endMonth', required: true, example: 9 })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF file download' })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Get('pdf')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async downloadPdf(@Query('startYear') startYear: string, @Query('startMonth') startMonth: string, @Query('endYear') endYear: string, @Query('endMonth') endMonth: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const period = this.parsePeriod(startYear, startMonth, endYear, endMonth);
    const buffer = await this.reportsService.generatePdf(user.id, user.name, user.email, period, user);
    const filename = `report_${period.startYear}-${String(period.startMonth).padStart(2, '0')}_to_${period.endYear}-${String(period.endMonth).padStart(2, '0')}.pdf`;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  private parsePeriod(startYear: string, startMonth: string, endYear: string, endMonth: string) {
    const sy = parseInt(startYear, 10); const sm = parseInt(startMonth, 10);
    const ey = parseInt(endYear, 10); const em = parseInt(endMonth, 10);
    if ([sy, sm, ey, em].some(Number.isNaN)) throw new BadRequestException('startYear, startMonth, endYear, endMonth are required and must be integers');
    if (sm < 1 || sm > 12 || em < 1 || em > 12) throw new BadRequestException('Month values must be between 1 and 12');
    if (ey < sy || (ey === sy && em < sm)) throw new BadRequestException('End period cannot be before start period');
    return { startYear: sy, startMonth: sm, endYear: ey, endMonth: em };
  }
}
