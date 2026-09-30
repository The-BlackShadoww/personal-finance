import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

type CacheEntry = {
  user: AuthenticatedUser;
  expiresAt: number;
};

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;

/**
 * Short-lived in-process cache of authenticated users so the JWT guard does not
 * hit the database on every request. Anything that changes a cached field must
 * call `invalidate(userId)`; the TTL bounds staleness for everything else
 * (e.g. soft-deleted users lose access within a minute).
 */
@Injectable()
export class UserCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  get(userId: string): AuthenticatedUser | undefined {
    const entry = this.entries.get(userId);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(userId);
      return undefined;
    }

    return entry.user;
  }

  set(user: AuthenticatedUser): void {
    if (this.entries.size >= MAX_ENTRIES) {
      // Map preserves insertion order, so the first key is the oldest entry.
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(user.id, { user, expiresAt: Date.now() + TTL_MS });
  }

  invalidate(userId: string): void {
    this.entries.delete(userId);
  }
}
