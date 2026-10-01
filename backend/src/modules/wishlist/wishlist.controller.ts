import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateWishlistItemDto,
  DecideWishlistItemDto,
} from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('Cooling-off list')
@ApiBearerAuth('access-token')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @ApiOperation({
    summary: 'Get the cooling-off list',
    description:
      'Items still waiting (with whether their cooling-off time has passed), recent decisions, ' +
      "this year's skipped and bought totals, and the cooling-off settings.",
  })
  @ApiResponse({ status: 200, description: 'Cooling-off list' })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlistService.list(user.id, user.timezone);
  }

  @ApiOperation({
    summary: 'Add a want to the cooling-off list',
    description:
      'It waits for the cooling-off time from the financial profile (48 hours by default) before it can be bought.',
  })
  @ApiBody({ type: CreateWishlistItemDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWishlistItemDto,
  ) {
    return this.wishlistService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Decide: bought, skipped, or back to waiting' })
  @ApiParam({ name: 'id', description: 'Item UUID' })
  @ApiBody({ type: DecideWishlistItemDto })
  @ApiResponse({ status: 400, type: ApiErrorResponse })
  @Patch(':id')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideWishlistItemDto,
  ) {
    return this.wishlistService.decide(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Remove an item' })
  @ApiParam({ name: 'id', description: 'Item UUID' })
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wishlistService.remove(user.id, id);
  }
}
