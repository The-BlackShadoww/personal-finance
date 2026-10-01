import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({ imports: [AccountsModule], controllers: [AccountController], providers: [AccountService], exports: [AccountService] })
export class AccountModule {}
