import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { CalculationsModule } from '../calculations/calculations.module';
import { InsightsModule } from '../insights/insights.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [BudgetsModule, CalculationsModule, InsightsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
