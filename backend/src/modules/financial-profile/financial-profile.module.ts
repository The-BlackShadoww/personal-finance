import { Module } from '@nestjs/common';
import { FinancialProfileController } from './financial-profile.controller';
import { FinancialProfileService } from './financial-profile.service';

@Module({
  controllers: [FinancialProfileController],
  providers: [FinancialProfileService],
  exports: [FinancialProfileService],
})
export class FinancialProfileModule {}
