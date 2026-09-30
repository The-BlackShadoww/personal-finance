import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DB_TOKEN, type DrizzleDB } from './db.constants';
import * as schema from './schema';

const dbProvider: Provider = {
  provide: DB_TOKEN,
  useFactory: (config: ConfigService) => {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const client = postgres(url, {
      // Enough for the dashboard's parallel queries across a few concurrent
      // users without exhausting Neon's connection limits.
      max: 10,
      // Neon suspends an idle compute after 5 minutes and drops its
      // connections. Retiring idle connections first means a request never
      // tries a socket the server has already closed.
      idle_timeout: 240,
      connect_timeout: 10,
    });
    return drizzle(client, { schema });
  },
  inject: [ConfigService],
};

/**
 * Opens a first connection as soon as the app boots, so the TCP/TLS/auth
 * handshake (several network round trips) is not paid by the first request
 * after a deploy or cold start. Runs in the background; failures are only
 * logged because the pool connects lazily anyway.
 */
@Injectable()
class DbWarmup implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbWarmup.name);

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  onApplicationBootstrap() {
    const startedAt = Date.now();
    this.db
      .execute(sql`select 1`)
      .then(() =>
        this.logger.log(
          `Database connection warmed in ${Date.now() - startedAt}ms`,
        ),
      )
      .catch((error: unknown) =>
        this.logger.warn(`Database warm-up failed: ${String(error)}`),
      );
  }
}

@Global()
@Module({
  providers: [dbProvider, DbWarmup],
  exports: [DB_TOKEN],
})
export class DbModule {}
