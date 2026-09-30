import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { users } from '../../db/schema';
import { UserCacheService } from '../cache/user-cache.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type AccessTokenPayload = {
  sub: string;
  type?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly userCache: UserCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException();
      }

      const user = await this.loadUser(payload.sub);

      if (!user) {
        throw new UnauthorizedException();
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async loadUser(userId: string) {
    const cached = this.userCache.get(userId);

    if (cached) {
      return cached;
    }

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        twoFactorEnabled: users.twoFactorEnabled,
        timezone: users.timezone,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (user) {
      this.userCache.set(user);
    }

    return user;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
