import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import * as Joi from 'joi';
import { UserCacheModule } from './common/cache/user-cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ThrottlerStorageRedisService } from './common/throttler/throttler-storage-redis.service';
import configuration from './config/configuration';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CalculationsModule } from './modules/calculations/calculations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { AccountModule } from './modules/account/account.module';
import { FinancialProfileModule } from './modules/financial-profile/financial-profile.module';
import { GoalsModule } from './modules/goals/goals.module';
import { InsightsModule } from './modules/insights/insights.module';
import { RecurringModule } from './modules/recurring/recurring.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        TWO_FACTOR_ENCRYPTION_KEY: Joi.string().length(64).required(),
        FRONTEND_URL: Joi.string().required(),
        BACKEND_URL: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        REDIS_URL: Joi.string().optional(),
        PORT: Joi.number().optional(),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url');
        const redisClient = redisUrl
          ? new Redis(redisUrl, {
              lazyConnect: true,
              maxRetriesPerRequest: 1,
            })
          : null;

        redisClient?.on('error', () => {
          // ioredis emits connection errors even when callers handle rejected
          // commands. The storage layer falls back to an in-memory limiter.
        });

        return {
          throttlers: [{ name: 'default', limit: 100, ttl: 60000 }],
          ...(redisClient
            ? { storage: new ThrottlerStorageRedisService(redisClient) }
            : {}),
          getTracker: (request: Record<string, any>) =>
            request.user?.id ?? request.ip,
        };
      },
    }),
    DbModule,
    UserCacheModule,
    AuthModule,
    CategoriesModule,
    CalculationsModule,
    BudgetsModule,
    TransactionsModule,
    ReportsModule,
    UsersModule,
    AccountModule,
    FinancialProfileModule,
    GoalsModule,
    RecurringModule,
    InsightsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
