import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { categories } from '../../db/schema';
import { AccountsService } from '../accounts/accounts.service';

/** The fields that decide what an entry is and where its money moves. */
export type EntryShape = {
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
};

/**
 * Rules shared by ledger entries and the recurring rules that post them:
 * income/expense need a matching category and no destination; transfers
 * need two different accounts and no category. New or changed accounts
 * must be active.
 */
@Injectable()
export class LedgerValidator {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly accountsService: AccountsService,
  ) {}

  async assertValidShape(
    userId: string,
    shape: EntryShape,
    { unchangedAccountIds = [] }: { unchangedAccountIds?: string[] } = {},
  ) {
    const checkAccount = (accountId: string) =>
      unchangedAccountIds.includes(accountId)
        ? this.accountsService.findOwned(userId, accountId)
        : this.accountsService.findActive(userId, accountId);

    if (shape.type === 'transfer') {
      if (shape.categoryId) {
        throw new BadRequestException('Transfers do not have a category');
      }
      if (!shape.counterAccountId) {
        throw new BadRequestException(
          'Choose the account the money is moving to',
        );
      }
      if (shape.counterAccountId === shape.accountId) {
        throw new BadRequestException(
          'A transfer needs two different accounts',
        );
      }
      await Promise.all([
        checkAccount(shape.accountId),
        checkAccount(shape.counterAccountId),
      ]);
      return;
    }

    if (shape.counterAccountId) {
      throw new BadRequestException(
        'Only transfers have a destination account',
      );
    }
    if (!shape.categoryId) {
      throw new BadRequestException('Choose a category');
    }

    const [[category]] = await Promise.all([
      this.db
        .select({ type: categories.type })
        .from(categories)
        .where(
          and(
            eq(categories.id, shape.categoryId),
            eq(categories.userId, userId),
            isNull(categories.deletedAt),
          ),
        )
        .limit(1),
      checkAccount(shape.accountId),
    ]);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.type !== shape.type) {
      throw new BadRequestException(
        'Transaction type must match category type',
      );
    }
  }
}
