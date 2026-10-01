import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { InsightsModule } from '../insights/insights.module';
import { RecurringModule } from '../recurring/recurring.module';
import { CalculationsController } from './calculations.controller';
import { CalculationsService } from './calculations.service';

@Module({
  imports: [AccountModule, InsightsModule, RecurringModule],
  controllers: [CalculationsController],
  providers: [CalculationsService],
  exports: [CalculationsService],
})
export class CalculationsModule {}
