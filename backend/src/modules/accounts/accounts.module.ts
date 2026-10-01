import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ValuationsService } from './valuations.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, ValuationsService],
  exports: [AccountsService, ValuationsService],
})
export class AccountsModule {}
