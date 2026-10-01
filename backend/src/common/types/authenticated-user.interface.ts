export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  timezone: string;
  currency: string;
  locale: string;
}
