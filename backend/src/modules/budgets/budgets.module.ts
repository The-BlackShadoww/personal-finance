import { Module } from '@nestjs/common';
import { CalculationsModule } from '../calculations/calculations.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { PlanService } from './plan.service';

@Module({
  imports: [CalculationsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, PlanService],
})
export class BudgetsModule {}
