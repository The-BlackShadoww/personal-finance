import type { ApiResponse } from "@/types/api";

import { apiClient } from "./client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  timezone: string;
  /** ISO 4217 code, e.g. "BDT". */
  currency: string;
  /** BCP 47 tag used for number formatting, e.g. "en-IN". */
  locale: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
  timezone?: string;
  currency?: string;
  locale?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetupResponse {
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

export const usersApi = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient<ApiResponse<UserProfile>>("/auth/me");

    return response.data;
  },

  async updateProfile(data: UpdateProfilePayload): Promise<UserProfile> {
    const response = await apiClient<ApiResponse<UserProfile>>("/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return response.data;
  },

  async changePassword(
    data: ChangePasswordPayload,
  ): Promise<{ success: boolean }> {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(
      "/users/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    return response.data;
  },

  async setup2fa(): Promise<TwoFactorSetupResponse> {
    const response = await apiClient<ApiResponse<TwoFactorSetupResponse>>(
      "/auth/2fa/setup",
      { method: "POST" },
    );

    return response.data;
  },

  async enable2fa(code: string): Promise<{ success: boolean }> {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(
      "/auth/2fa/enable",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );

    return response.data;
  },

  async disable2fa(code: string): Promise<{ success: boolean }> {
    const response = await apiClient<ApiResponse<{ success: boolean }>>(
      "/auth/2fa/disable",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );

    return response.data;
  },
};
