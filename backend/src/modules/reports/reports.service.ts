import { BadRequestException, Injectable } from '@nestjs/common';
import { PassThrough } from 'stream';
import { writeToStream } from 'fast-csv';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { format } from 'date-fns';
import type { MoneyFormat } from '../../common/money/format';
import { TransactionsService } from '../transactions/transactions.service';
import FinancialReportDocument, { type ReportData } from './pdf/financial-report.document';

export type PeriodFilters = {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly transactionsService: TransactionsService) {}

  async generateCsv(userId: string, filters: PeriodFilters, money: MoneyFormat) {
    this.assertPeriodRange(filters);
    const rows = await this.transactionsService.getRawTransactionsForReport(
      userId, filters.startYear, filters.startMonth, filters.endYear, filters.endMonth,
    );
    const stream = new PassThrough();

    writeToStream(
      stream,
      rows.map((transaction) => ({
        Period: format(new Date(transaction.transactionYear, transaction.transactionMonth - 1, 1), 'MMMM yyyy'),
        'Handover Date': format(transaction.date, 'MMM d, yyyy'),
        Type: transaction.type,
        Category: transaction.categoryName ?? '',
        // For transfers: the source account.
        Account: transaction.accountName,
        'To Account': transaction.counterAccountName ?? '',
        // A plain number keeps the column summable in spreadsheets.
        [`Amount (${money.currency})`]: (transaction.amountCents / 100).toFixed(2),
        Note: transaction.note ?? '',
      })),
      { headers: true },
    ).on('error', (error) => stream.destroy(error));

    return stream;
  }

  async generatePdf(userId: string, userName: string, userEmail: string, filters: PeriodFilters, money: MoneyFormat): Promise<Buffer> {
    this.assertPeriodRange(filters);
    const rawTransactions = await this.transactionsService.getRawTransactionsForReport(
      userId, filters.startYear, filters.startMonth, filters.endYear, filters.endMonth,
    );
    const totalIncomeCents = rawTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amountCents, 0);
    const totalExpenseCents = rawTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amountCents, 0);
    const savingsCents = totalIncomeCents - totalExpenseCents;

    const reportData: ReportData = {
      period: {
        startDate: `${filters.startYear}-${String(filters.startMonth).padStart(2, '0')}-01`,
        endDate: `${filters.endYear}-${String(filters.endMonth).padStart(2, '0')}-01`,
        label: this.buildPeriodLabel(filters),
      },
      user: { name: userName, email: userEmail },
      money: { currency: money.currency, locale: money.locale },
      summary: {
        totalIncomeCents, totalExpenseCents, savingsCents,
        savingsRate: totalIncomeCents > 0 ? ((savingsCents / totalIncomeCents) * 100).toFixed(1) : '0.0',
        transactionCount: rawTransactions.length,
      },
      transactions: rawTransactions.flatMap((t) => t.type === 'transfer' ? [] : [{
        period: format(new Date(t.transactionYear, t.transactionMonth - 1, 1), 'MMM yyyy'),
        handoverDate: format(t.date, 'MMM d'),
        type: t.type, categoryName: t.categoryName ?? '', accountName: t.accountName, amountCents: t.amountCents, note: t.note,
      }]),
      transfers: rawTransactions.flatMap((t) => t.type !== 'transfer' ? [] : [{
        period: format(new Date(t.transactionYear, t.transactionMonth - 1, 1), 'MMM yyyy'),
        handoverDate: format(t.date, 'MMM d'),
        fromAccount: t.accountName, toAccount: t.counterAccountName ?? '', amountCents: t.amountCents, note: t.note,
      }]),
      generatedAt: format(new Date(), "MMMM d, yyyy 'at' h:mm a"),
    };

    return (await renderToBuffer(createElement(FinancialReportDocument, { data: reportData }) as any)) as unknown as Buffer;
  }

  private assertPeriodRange({ startYear, startMonth, endYear, endMonth }: PeriodFilters) {
    if (![startYear, startMonth, endYear, endMonth].every(Number.isInteger)) throw new BadRequestException('Period values must be integers');
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) throw new BadRequestException('Month values must be between 1 and 12');
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) throw new BadRequestException('End period cannot be before start period');
  }

  private buildPeriodLabel({ startYear, startMonth, endYear, endMonth }: PeriodFilters) {
    const start = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);
    if (startYear === endYear && startMonth === endMonth) return format(start, 'MMMM yyyy');
    if (startYear === endYear) return `${format(start, 'MMMM')} – ${format(end, 'MMMM yyyy')}`;
    return `${format(start, 'MMMM yyyy')} – ${format(end, 'MMMM yyyy')}`;
  }

}
