import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountModule } from '../account/account.module';
import { AccountsModule } from '../accounts/accounts.module';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [AccountModule, AccountsModule, GoalsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
