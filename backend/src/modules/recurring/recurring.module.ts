import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { GoalsModule } from '../goals/goals.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  imports: [AccountsModule, GoalsModule, LedgerModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
