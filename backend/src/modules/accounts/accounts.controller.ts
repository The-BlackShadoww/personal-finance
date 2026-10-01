import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponse } from '../../common/swagger/api-response.swagger';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AccountsService } from './accounts.service';
import {
  CreateAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
} from './dto/account.dto';

@ApiTags('Accounts')
@ApiBearerAuth('access-token')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOperation({
    summary: 'List accounts with balances',
    description:
      'Every account with its current balance (owned for assets, owed for liabilities), a ' +
      'six-month month-end balance trend, and totals: assets, liabilities, net worth and ' +
      'liquid money. A default "Main account" is created for users who have none.',
  })
  @ApiResponse({ status: 200, description: 'Accounts and totals' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAccountsQueryDto,
  ) {
    return this.accountsService.list(
      user.id,
      user.timezone,
      query.includeArchived ?? false,
    );
  }

  @ApiOperation({ summary: 'Create an account' })
  @ApiBody({ type: CreateAccountDto })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiBody({ type: UpdateAccountDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @ApiResponse({ status: 404, type: ApiErrorResponse })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Archive an account',
    description:
      'Hides the account from pickers while keeping its history. The balance must be zero ' +
      'and the account cannot be the default.',
  })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.archive(user.id, id);
  }

  @ApiOperation({ summary: 'Restore an archived account' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.restore(user.id, id);
  }

  @ApiOperation({
    summary: 'Delete an unused account',
    description:
      'Only accounts without transactions can be deleted; archive the others.',
  })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.remove(user.id, id);
  }
}
