import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountsModule } from '../accounts/accounts.module';
import { GoalsModule } from '../goals/goals.module';

@Module({ imports: [AccountsModule, GoalsModule], controllers: [AccountController], providers: [AccountService], exports: [AccountService] })
export class AccountModule {}
