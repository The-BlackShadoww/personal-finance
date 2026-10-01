import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { and, eq, isNull } from 'drizzle-orm';
import { UserCacheService } from '../../common/cache/user-cache.service';
import { DB_TOKEN, type DrizzleDB } from '../../db/db.constants';
import { users } from '../../db/schema';
import { canonicalLocale } from '../../common/money/locale';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly userCache: UserCacheService,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ) {
    if (!dto.name && !dto.avatarUrl && !dto.timezone && !dto.currency && !dto.locale) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const locale = dto.locale === undefined ? undefined : canonicalLocale(dto.locale);
    if (locale === null) {
      throw new BadRequestException('locale must be a valid BCP 47 language tag');
    }

    const [updated] = await this.db
      .update(users)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(locale !== undefined && { locale }),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        timezone: users.timezone,
        currency: users.currency,
        locale: users.locale,
      });

    if (!updated) throw new NotFoundException('User not found');
    this.userCache.invalidate(userId);
    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {

    // Step 1: Fetch the user including their current passwordHash
    const [user] = await this.db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    // Step 2: OAuth-only users have no password — they cannot use this endpoint
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Your account uses Google sign-in and does not have a password. ' +
        'You cannot change a password that was never set.'
      );
    }

    // Step 3: Verify the current password
    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Step 4: Reject if new password is the same as current
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from your current password');
    }

    // Step 5: Hash and save the new password
    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  }
}
