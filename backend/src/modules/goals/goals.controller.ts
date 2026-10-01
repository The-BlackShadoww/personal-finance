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
import {
  ContributeDto,
  CreateGoalDto,
  ListGoalsQueryDto,
  ReorderGoalsDto,
  UpdateGoalDto,
  WithdrawDto,
} from './dto/goal.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@ApiBearerAuth('access-token')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @ApiOperation({
    summary: 'List goals with balances and progress',
    description:
      "Goals earmark money inside accounts. Includes each goal's balance, monthly pace, required " +
      "monthly amount and status, the emergency fund's months of cover, and totals: earmarked " +
      'money and money available to spend. An emergency fund is created for users who have none.',
  })
  @ApiResponse({ status: 200, description: 'Goals and summary' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.goalsService.list(
      user.id,
      user.timezone,
      query.includeArchived ?? false,
    );
  }

  @ApiOperation({ summary: 'Create a goal' })
  @ApiBody({ type: CreateGoalDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, dto);
  }

  @ApiOperation({
    summary: 'Set the order income is shared out in',
    description:
      'Goals earlier in the list are funded first when an income arrives.',
  })
  @ApiBody({ type: ReorderGoalsDto })
  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderGoalsDto,
  ) {
    return this.goalsService.reorder(user.id, dto.ids);
  }

  @ApiOperation({
    summary: 'Undo the automatic set-aside from an income',
    description:
      'Removes the goal contributions an income created, and any transfers they made.',
  })
  @ApiParam({ name: 'transactionId', description: 'The income transaction' })
  @Delete('allocations/:transactionId')
  undoAllocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.goalsService.undoAllocation(user.id, transactionId);
  }

  @ApiOperation({ summary: 'Update a goal' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiBody({ type: UpdateGoalDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Add money to a goal',
    description:
      "Earmarks money already in the goal's account, or moves it there from fromAccountId with a transfer.",
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiBody({ type: ContributeDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post(':id/contributions')
  contribute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContributeDto,
  ) {
    return this.goalsService.contribute(user.id, user.timezone, id, dto);
  }

  @ApiOperation({
    summary: 'Take money out of a goal',
    description:
      'Requires a reason. The money stays in the account and becomes available to spend.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiBody({ type: WithdrawDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post(':id/withdrawals')
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.goalsService.withdraw(user.id, user.timezone, id, dto);
  }

  @ApiOperation({ summary: 'Archive a goal' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.archive(user.id, id);
  }

  @ApiOperation({ summary: 'Restore an archived goal' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.restore(user.id, id);
  }

  @ApiOperation({
    summary: 'Delete a goal',
    description:
      'Money set aside for it becomes available again. The emergency fund cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.remove(user.id, id);
  }
}
