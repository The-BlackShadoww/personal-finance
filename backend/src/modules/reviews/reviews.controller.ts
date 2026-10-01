import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
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
import { CompleteReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Monthly review')
@ApiBearerAuth('access-token')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({
    summary: 'Is a monthly review due?',
    description:
      "Returns last month as `due` when it had activity and hasn't been reviewed, plus the last 12 reviews.",
  })
  @ApiResponse({ status: 200, description: 'Review status' })
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.getStatus(user.id, user.timezone);
  }

  @ApiOperation({
    summary: "Get a month's review",
    description:
      'For a month that has ended: the numbers (income, spending, savings rate vs target, net-worth ' +
      'change, health score change), three wins, three leaks, the top five discretionary categories ' +
      "to rate, suggested actions, last month's commitment, and the saved answers if completed.",
  })
  @ApiParam({ name: 'year', example: 2026 })
  @ApiParam({ name: 'month', example: 9 })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Get(':year/:month')
  getReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.reviewsService.getReview(user, year, month);
  }

  @ApiOperation({
    summary: 'Complete a monthly review',
    description:
      "Saves the ratings and next month's commitment (and whether last month's was done). Returns " +
      "categories rated 'no' in an earlier review too, as candidates for a lower budget.",
  })
  @ApiParam({ name: 'year', example: 2026 })
  @ApiParam({ name: 'month', example: 9 })
  @ApiBody({ type: CompleteReviewDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Put(':year/:month')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: CompleteReviewDto,
  ) {
    return this.reviewsService.complete(user, year, month, dto);
  }
}
