import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';

@Module({
  imports: [AccountsModule],
  controllers: [WealthController],
  providers: [WealthService],
})
export class WealthModule {}
