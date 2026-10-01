import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerValidator } from './ledger-validator.service';

@Module({
  imports: [AccountsModule],
  providers: [LedgerValidator],
  exports: [LedgerValidator],
})
export class LedgerModule {}
