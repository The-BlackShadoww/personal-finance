import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountModule } from '../account/account.module';
import { AccountsModule } from '../accounts/accounts.module';
import { GoalsModule } from '../goals/goals.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurringModule } from '../recurring/recurring.module';

@Module({
  imports: [AccountModule, AccountsModule, GoalsModule, LedgerModule, RecurringModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
