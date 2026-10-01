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
  ConfirmOccurrenceDto,
  CreateRecurringDto,
  UpdateRecurringDto,
} from './dto/recurring.dto';
import { RecurringService } from './recurring.service';

@ApiTags('Recurring')
@ApiBearerAuth('access-token')
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @ApiOperation({
    summary: 'List recurring rules',
    description:
      'Posts any due auto-post occurrences first, then returns the rules, occurrences waiting for ' +
      'confirmation, the coming month (up to the same date next month), and subscription totals per month and year.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rules, due, upcoming, subscriptions',
  })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.recurringService.list(user.id, user.timezone);
  }

  @ApiOperation({ summary: 'Create a recurring rule' })
  @ApiBody({ type: CreateRecurringDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringDto,
  ) {
    return this.recurringService.create(user.id, user.timezone, dto);
  }

  @ApiOperation({
    summary: 'Update a recurring rule',
    description:
      'Changing the schedule restarts it from today; posted entries are unchanged.',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiBody({ type: UpdateRecurringDto })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurringService.update(user.id, user.timezone, id, dto);
  }

  @ApiOperation({
    summary: 'Post the next occurrence now',
    description:
      'For rules that wait for confirmation, or to post early. The amount can differ this time.',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiBody({ type: ConfirmOccurrenceDto })
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOccurrenceDto,
  ) {
    return this.recurringService.confirm(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Skip the next occurrence' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringService.skip(user.id, id);
  }

  @ApiOperation({ summary: 'Pause a rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringService.pause(user.id, id);
  }

  @ApiOperation({
    summary: 'Resume a paused rule',
    description:
      'Continues from today; occurrences missed while paused are not posted.',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringService.resume(user.id, user.timezone, id);
  }

  @ApiOperation({
    summary: 'Delete a recurring rule',
    description: 'Entries it already posted stay in the ledger.',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringService.remove(user.id, id);
  }
}
