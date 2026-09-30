import { Global, Module } from '@nestjs/common';
import { UserCacheService } from './user-cache.service';

@Global()
@Module({
  providers: [UserCacheService],
  exports: [UserCacheService],
})
export class UserCacheModule {}
