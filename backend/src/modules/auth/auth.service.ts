import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { encryptSecret, decryptSecret } from './utils/crypto.utils';
import { UserCacheService } from '../../common/cache/user-cache.service';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { categories, refreshTokens, users } from '../../db/schema';
import { DEFAULT_CATEGORIES } from '../categories/default-categories';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

export type LoginResult =
  | { requiresTwoFactor: true; tempToken: string }
  | { accessToken: string; refreshToken: string };

type TokenResult = {
  accessToken: string;
  refreshToken: string;
};

type TokenFamily = ReturnType<typeof randomUUID>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userCache: UserCacheService,
  ) {}

  async upsertGoogleUser(googleUser: {
    googleId: string;
    email: string | null;
    name: string;
    avatarUrl: string | null;
  }): Promise<{ id: string; email: string; name: string }> {

    // Step 1: Try to find an existing user by googleId
    // This handles returning users who previously signed in with Google
    const existingByGoogleId = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.googleId, googleUser.googleId),
          isNull(users.deletedAt),
        )
      )
      .limit(1);

    if (existingByGoogleId.length > 0) {
      // User exists — return them as-is
      // We intentionally do NOT update their name or avatar on every login:
      // if they changed their Google profile but also customized their app
      // profile, we'd silently overwrite their changes. Let them update
      // their profile manually in Settings.
      const user = existingByGoogleId[0];
      return { id: user.id, email: user.email, name: user.name };
    }

    // Step 2: If no user found by googleId, check if their email already exists
    // This handles the case: user registered with email/password using the SAME
    // email address, then later tries to "Sign in with Google".
    // We link the Google account to their existing account instead of
    // creating a duplicate account.
    if (googleUser.email) {
      const existingByEmail = await this.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, googleUser.email),
            isNull(users.deletedAt),
          )
        )
        .limit(1);

      if (existingByEmail.length > 0) {
        // Link the Google ID to the existing account
        const [updatedUser] = await this.db
          .update(users)
          .set({
            googleId: googleUser.googleId,
            avatarUrl: googleUser.avatarUrl ?? existingByEmail[0].avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail[0].id))
          .returning({ id: users.id, email: users.email, name: users.name });

        this.userCache.invalidate(updatedUser.id);
        return updatedUser;
      }
    }

    // Step 3: Completely new user — create their account
    // OAuth users have no passwordHash (they authenticate via Google, not password)
    const email = googleUser.email;
    if (!email) {
      // Google did not return an email — this is rare but possible
      // (user may have denied email permission in the consent screen)
      // We cannot create an account without an email — it's our unique identifier
      throw new BadRequestException(
        'Google account did not provide an email address. ' +
        'Please ensure your Google account has a verified email.'
      );
    }

    const [newUser] = await this.db
      .insert(users)
      .values({
        name: googleUser.name,
        email: email,
        passwordHash: null,       // OAuth users have no password
        googleId: googleUser.googleId,
        avatarUrl: googleUser.avatarUrl,
        // twoFactorEnabled defaults to false (from schema)
        // timezone defaults to 'UTC' (from schema)
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    await this.seedDefaultCategories(newUser.id);

    return newUser;
  }

  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, dto.email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      });

    await this.seedDefaultCategories(user.id);

    return user;
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const [user] = await this.db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(and(eq(users.email, dto.email), isNull(users.deletedAt)))
      .limit(1);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.twoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id },
        { expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    return this.generateTokens(user.id);
  }

  async refreshToken(rawRefreshToken?: string): Promise<TokenResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [family, rawToken, extra] = rawRefreshToken.split('.');

    if (
      !family ||
      !rawToken ||
      extra !== undefined ||
      !UUID_PATTERN.test(family)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenFamily = family as TokenFamily;

    // Joining users folds the "is the account still active" check into the
    // token lookup, saving a round trip on every refresh.
    const now = new Date();
    const [activeToken] = await this.db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        tokenHash: refreshTokens.tokenHash,
      })
      .from(refreshTokens)
      .innerJoin(
        users,
        and(eq(users.id, refreshTokens.userId), isNull(users.deletedAt)),
      )
      .where(
        and(
          eq(refreshTokens.tokenFamily, tokenFamily),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(refreshTokens.createdAt))
      .limit(1);

    if (!activeToken) {
      const [latestFamilyToken] = await this.db
        .select({
          userId: refreshTokens.userId,
          isRevoked: refreshTokens.isRevoked,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenFamily, tokenFamily))
        .orderBy(desc(refreshTokens.createdAt))
        .limit(1);

      if (latestFamilyToken?.isRevoked) {
        await this.revokeAllRefreshTokens(latestFamilyToken.userId);
      }

      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await this.verifyRefreshTokenHash(
      rawToken,
      activeToken.tokenHash,
    );

    if (!tokenMatches) {
      await this.revokeAllRefreshTokens(activeToken.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke the presented token and issue its successor in one statement.
    // The `is_revoked = false` guard makes rotation atomic: if two requests
    // race with the same token, only one gets a successor.
    const next = this.createRefreshTokenSecret();
    const rotated = await this.db.execute<{ id: string }>(sql`
      WITH revoked AS (
        UPDATE refresh_tokens
        SET is_revoked = true
        WHERE id = ${activeToken.id} AND is_revoked = false
        RETURNING user_id
      )
      INSERT INTO refresh_tokens (user_id, token_family, token_hash, expires_at, is_revoked)
      SELECT user_id, ${tokenFamily}::uuid, ${next.hash}, ${this.refreshTokenExpiry().toISOString()}::timestamptz, false
      FROM revoked
      RETURNING id
    `);

    if (rotated.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: this.signAccessToken(activeToken.userId),
      refreshToken: `${tokenFamily}.${next.value}`,
    };
  }

  async generateTokens(
    userId: string,
    tokenFamily: TokenFamily = randomUUID(),
  ): Promise<TokenResult> {
    const next = this.createRefreshTokenSecret();

    await this.db.insert(refreshTokens).values({
      userId,
      tokenFamily,
      tokenHash: next.hash,
      expiresAt: this.refreshTokenExpiry(),
      isRevoked: false,
    });

    return {
      accessToken: this.signAccessToken(userId),
      refreshToken: `${tokenFamily}.${next.value}`,
    };
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign({ sub: userId, type: 'access' });
  }

  private refreshTokenExpiry(): Date {
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshTokenExpiresIn') ?? '7d';
    return new Date(Date.now() + this.parseDuration(refreshExpiresIn));
  }

  // Refresh tokens are 64 random bytes, so a fast SHA-256 digest is as strong
  // as a slow password hash here; bcrypt only makes sense for low-entropy
  // human passwords.
  private createRefreshTokenSecret(): { value: string; hash: string } {
    const value = randomBytes(64).toString('hex');
    return { value, hash: this.hashRefreshToken(value) };
  }

  private hashRefreshToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async verifyRefreshTokenHash(
    rawToken: string,
    storedHash: string,
  ): Promise<boolean> {
    // Tokens issued before the switch to SHA-256 were bcrypt-hashed; accept
    // them until they expire so existing sessions survive the deploy.
    if (storedHash.startsWith('$2')) {
      return bcrypt.compare(rawToken, storedHash);
    }

    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(this.hashRefreshToken(rawToken), 'hex');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  async setupTwoFactor(
    userId: string,
    userEmail: string,
  ): Promise<{ otpAuthUrl: string; qrCodeDataUrl: string }> {
    const totp = new OTPAuth.TOTP({
      issuer: 'FinanceApp',
      label: userEmail,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret(),
    });

    const rawSecret = totp.secret.base32;
    const encryptionKey = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    
    if (!encryptionKey) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not defined');
    }

    const encryptedSecret = encryptSecret(rawSecret, encryptionKey);

    await this.db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const otpAuthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
      errorCorrectionLevel: 'M',
      width: 256,
      margin: 2,
    });

    return { otpAuthUrl, qrCodeDataUrl };
  }

  async enableTwoFactor(userId: string, code: string): Promise<{ success: boolean }> {
    const [user] = await this.db
      .select({
        twoFactorSecret: users.twoFactorSecret,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'No 2FA secret found. Call POST /auth/2fa/setup first to generate a secret.'
      );
    }

    const encryptionKey = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not defined');
    }

    const rawSecret = decryptSecret(user.twoFactorSecret, encryptionKey);
    const isValid = this.verifyTotpCode(rawSecret, code);

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid code. Make sure your authenticator app is showing the current code and your device clock is correct.'
      );
    }

    await this.db
      .update(users)
      .set({ twoFactorEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId));

    this.userCache.invalidate(userId);
    return { success: true };
  }

  async verifyTwoFactorLogin(
    tempToken: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify(tempToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired session. Please log in again.');
    }

    if (payload.type !== 'two_factor_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const userId = payload.sub;

    const [user] = await this.db
      .select({
        twoFactorSecret: users.twoFactorSecret,
        twoFactorEnabled: users.twoFactorEnabled,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }

    const encryptionKey = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not defined');
    }

    const rawSecret = decryptSecret(user.twoFactorSecret, encryptionKey);
    const isValid = this.verifyTotpCode(rawSecret, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return this.generateTokens(userId);
  }

  async disableTwoFactor(userId: string, code: string): Promise<{ success: boolean }> {
    const [user] = await this.db
      .select({
        twoFactorSecret: users.twoFactorSecret,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not currently enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('No 2FA secret found — cannot verify code');
    }

    const encryptionKey = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not defined');
    }

    const rawSecret = decryptSecret(user.twoFactorSecret, encryptionKey);
    const isValid = this.verifyTotpCode(rawSecret, code);

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid code. You must provide a valid authenticator code to disable 2FA.'
      );
    }

    await this.db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    this.userCache.invalidate(userId);
    return { success: true };
  }

  private verifyTotpCode(rawSecret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: 'FinanceApp',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(rawSecret),
    });

    const delta = totp.validate({
      token: code,
      window: 1,
    });

    return delta !== null;
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * unitMs[match[2]];
  }

  async seedDefaultCategories(userId: string): Promise<void> {
    const types = ['income', 'expense'] as const;

    await this.db.insert(categories).values(
      types.flatMap((type) =>
        DEFAULT_CATEGORIES.filter((d) => d.type === type).map((d, sortOrder) => ({
          ...d,
          userId,
          isDefault: true,
          sortOrder,
        })),
      ),
    );
  }
}
