import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Cheap endpoint for uptime monitors and keep-warm pings. It deliberately ' +
      'does not touch the database, so pinging it never wakes a scaled-to-zero ' +
      'Neon compute or consumes its compute hours.',
  })
  @ApiResponse({ status: 200, description: 'The API process is up' })
  @Public()
  @SkipThrottle()
  @Get()
  check() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
