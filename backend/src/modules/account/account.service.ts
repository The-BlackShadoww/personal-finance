import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { AccountsService } from '../accounts/accounts.service';
import { accountConfig, savingsSectors } from '../../db/schema';
import { SetupAccountDto } from './dto/setup-account.dto';
import { UpsertSectorDto } from './dto/upsert-sector.dto';

@Injectable()
export class AccountService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB, private readonly accountsService: AccountsService) {}

  async getAccountConfig(userId: string) {
    const [config] = await this.db.select().from(accountConfig).where(eq(accountConfig.userId, userId)).limit(1);
    return config ?? { id: null, userId, initialBalanceCents: 0, lowBalanceThresholdCents: 500000 };
  }

  /** The initial balance becomes the default account's opening balance; the threshold applies to liquid money. */
  async setupAccount(userId: string, dto: SetupAccountDto) {
    const initialBalanceCents = Math.round(dto.initialBalance * 100);
    const lowBalanceThresholdCents = Math.round((dto.lowBalanceThreshold ?? 5000) * 100);
    await this.accountsService.setDefaultOpeningBalance(userId, initialBalanceCents);
    const [result] = await this.db.insert(accountConfig).values({ userId, lowBalanceThresholdCents })
      .onConflictDoUpdate({ target: accountConfig.userId, set: { lowBalanceThresholdCents, updatedAt: new Date() } }).returning();
    return { initialBalance: initialBalanceCents / 100, lowBalanceThreshold: Number(result.lowBalanceThresholdCents) / 100 };
  }

  // "Balance" is liquid money (cash, bank, mobile wallets, savings). Moving money into investments or paying down debt
  // leaves it without counting as spending.
  async getCurrentBalance(userId: string) {
    const [{ accounts, totals }, flowRows, config] = await Promise.all([
      this.accountsService.getBalances(userId),
      this.db.execute<{ total_income_cents: number | string; total_expense_cents: number | string }>(sql`
        SELECT COALESCE(SUM(amount_cents) FILTER (WHERE type = 'income'), 0) AS total_income_cents,
               COALESCE(SUM(amount_cents) FILTER (WHERE type = 'expense'), 0) AS total_expense_cents
        FROM transactions WHERE user_id = ${userId} AND deleted_at IS NULL
      `),
      this.getAccountConfig(userId),
    ]);
    // postgres-js returns bigint aggregates as strings.
    const totalIncomeCents = Number(flowRows[0]?.total_income_cents ?? 0);
    const totalExpenseCents = Number(flowRows[0]?.total_expense_cents ?? 0);
    const initialBalanceCents = accounts.filter((a) => a.isLiquid && a.nature === 'asset').reduce((sum, a) => sum + a.openingBalanceCents, 0);
    const lowBalanceThresholdCents = Number(config.lowBalanceThresholdCents);
    const currentBalanceCents = totals.liquidCents;
    return { currentBalanceCents, initialBalanceCents, totalIncomeCents, totalExpenseCents, lowBalanceThresholdCents, isLowBalance: currentBalanceCents < lowBalanceThresholdCents,
      netWorthCents: totals.netWorthCents, assetsCents: totals.assetsCents, liabilitiesCents: totals.liabilitiesCents };
  }

  async getAccountSummary(userId: string) {
    const [balance, sectors] = await Promise.all([this.getCurrentBalance(userId), this.getSectors(userId)]);
    const allocations = sectors.map((sector) => {
      const allocatedCents = Math.round((balance.currentBalanceCents * sector.percentage) / 100);
      return { ...sector, allocatedCents, targetAmountCents: sector.targetAmountCents ?? null,
        progressPercent: sector.targetAmountCents ? Math.min(Math.round((allocatedCents / sector.targetAmountCents) * 100), 100) : null };
    });
    const cashCents = balance.currentBalanceCents - allocations.reduce((sum, sector) => sum + sector.allocatedCents, 0);
    return { ...balance, currentBalanceDollars: balance.currentBalanceCents / 100, sectors: allocations,
      cash: { name: 'Cash' as const, percentage: balance.currentBalanceCents > 0 ? Math.round((cashCents / balance.currentBalanceCents) * 100) : 0, allocatedCents: cashCents, color: '#22c55e', icon: 'banknote' } };
  }

  async getSectors(userId: string) { return this.db.select().from(savingsSectors).where(eq(savingsSectors.userId, userId)).orderBy(asc(savingsSectors.sortOrder), asc(savingsSectors.name)); }

  async createSector(userId: string, dto: UpsertSectorDto) {
    this.assertNotCash(dto.name); await this.validatePercentageHeadroom(userId, dto.percentage);
    const [created] = await this.db.insert(savingsSectors).values({ userId, name: dto.name, percentage: dto.percentage, color: dto.color ?? '#6b7280', icon: dto.icon ?? 'piggy-bank', targetAmountCents: dto.targetAmount === undefined ? null : Math.round(dto.targetAmount * 100), sortOrder: dto.sortOrder ?? 0, isDefault: false }).returning();
    return created;
  }

  async updateSector(userId: string, sectorId: string, dto: UpsertSectorDto) {
    const [existing] = await this.db.select().from(savingsSectors).where(and(eq(savingsSectors.id, sectorId), eq(savingsSectors.userId, userId))).limit(1);
    if (!existing) throw new NotFoundException('Sector not found');
    this.assertNotCash(dto.name); await this.validatePercentageHeadroom(userId, dto.percentage, sectorId);
    const [updated] = await this.db.update(savingsSectors).set({ name: dto.name, percentage: dto.percentage, color: dto.color ?? existing.color, icon: dto.icon ?? existing.icon, targetAmountCents: dto.targetAmount === undefined ? existing.targetAmountCents : Math.round(dto.targetAmount * 100), sortOrder: dto.sortOrder ?? existing.sortOrder, updatedAt: new Date() }).where(eq(savingsSectors.id, sectorId)).returning();
    return updated;
  }

  async deleteSector(userId: string, sectorId: string) {
    const [existing] = await this.db.select({ id: savingsSectors.id }).from(savingsSectors).where(and(eq(savingsSectors.id, sectorId), eq(savingsSectors.userId, userId))).limit(1);
    if (!existing) throw new NotFoundException('Sector not found');
    await this.db.delete(savingsSectors).where(eq(savingsSectors.id, sectorId)); return { success: true };
  }

  async seedDefaultSectors(userId: string) {
    if ((await this.getSectors(userId)).length) return;
    await this.db.insert(savingsSectors).values([
      ['Education', '#2563eb', 'graduation-cap'], ['Health', '#db2777', 'heart'], ['Emergency', '#dc2626', 'shield'], ['Computer', '#7c3aed', 'laptop'], ['Investment', '#16a34a', 'trending-up'],
    ].map(([name, color, icon], sortOrder) => ({ userId, name, color, icon, percentage: 2, sortOrder, isDefault: true })));
  }

  private assertNotCash(name: string) { if (name.trim().toLowerCase() === 'cash') throw new BadRequestException('"Cash" is a reserved sector name. Choose a different name.'); }
  private async validatePercentageHeadroom(userId: string, percentage: number, excludeId?: string) {
    const total = (await this.getSectors(userId)).filter((sector) => sector.id !== excludeId).reduce((sum, sector) => sum + sector.percentage, 0);
    if (total + percentage > 99) throw new BadRequestException(`Cannot allocate ${percentage}%. Available headroom: ${99 - total}%. Cash must retain at least 1%.`);
  }
}
