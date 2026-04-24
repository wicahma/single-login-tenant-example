"use client";

import { manualAuthConfig } from "@/config";
import {
  EPasswordSource,
  EUsernameSource,
  TokenResponse,
  TResponseType,
  UserInfo,
  TokenValidationResponse,
  UpdateProfileRequest,
  PasswordResetSmsResponse,
  ValidateSmsOtpResponse,
  ValidateEmailOtpResponse,
  PasswordResetEmailOtpResponse,
  ResetProvider,
  UserProfileData,
  UserWorkInfo,
  UserUamWorkInfo,
} from "@/lib/types/auth";
import { encryptAES } from "@/lib/encryption";

export interface ApiResponse<T = any> {
  status: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}
export async function logoutUser(
  accessToken: string,
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Logout failed");
    }

    return {
      status: true,
      data: undefined,
      message: data.message || "Logout successful",
    };
  } catch (error) {
    console.error("[ClientAPI] Logout failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<ApiResponse<TokenResponse>> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken, workId: 60 }),
    });

    const data = await response.json();

    console.log("[ClientAPI] Refresh token data:", data);

    if (!response.ok) {
      throw new Error(data.message || "Token refresh failed");
    }

    return {
      status: true,
      data: {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        expiresIn: data.data.expiresIn,
        tokenType: data.data.tokenType || "Bearer",
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Token refresh failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function claimPreToken(
  preToken: string,
): Promise<ApiResponse<TokenResponse & UserInfo>> {
  try {
    const response = await fetch("/api/auth/pre-token/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user details");
    }

    console.log("[ClientAPI] Fetched user details with pre-token:", data);

    return {
      status: true,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Token refresh failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function getUserDetails(
  accessToken: string,
): Promise<ApiResponse<UserInfo>> {
  try {
    const usernameSource: EUsernameSource = (manualAuthConfig.usernameSource ||
      "Npk") as EUsernameSource;

    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-username-source": String(usernameSource),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user details");
    }

    console.log("[ClientAPI] Fetched user details:", data);

    return {
      status: true,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Failed to fetch user details:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function loginUser(
  identifier: string,
  password: string,
  usernameSource: EUsernameSource = "Npk",
  passwordSource: EPasswordSource | null = null,
  responseType: TResponseType = "default",
): Promise<ApiResponse<TokenResponse & UserInfo>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-username-source": String(usernameSource),
      "x-response-type": responseType,
    };

    if (passwordSource !== null) {
      headers["x-pass-source"] = String(passwordSource);
    }

    console.log("[ClientAPI] Attempting login with headers:", headers);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({
        identifier: encryptAES(identifier),
        password: encryptAES(password),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    console.log("[ClientAPI] Login successful, fetching user info...", data);

    if (responseType === "pre-token") {
      console.log("Pre token requested!", data);
      const preTokenResponse = await claimPreToken(data.data.preToken);

      if (!preTokenResponse.status || !preTokenResponse.data) {
        throw new Error("Failed to fetch user info after login");
      }

      const userResponse = await getUserDetails(
        preTokenResponse.data.accessToken,
      );

      if (!userResponse.status || !userResponse.data) {
        throw new Error("Failed to fetch user info after login");
      }

      console.log("Pre-token login response:", preTokenResponse);

      return {
        status: true,
        data: {
          accessToken: preTokenResponse.data.accessToken,
          refreshToken: preTokenResponse.data.refreshToken,
          expiresIn: preTokenResponse.data.expiresIn,
          tokenType: preTokenResponse.data.tokenType || "Bearer",
          ...userResponse.data,
        },
      };
    }

    const userResponse = await getUserDetails(data.data.accessToken);

    if (!userResponse.status || !userResponse.data) {
      throw new Error("Failed to fetch user info after login");
    }

    return {
      status: true,
      data: {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        expiresIn: data.data.expiresIn,
        tokenType: data.data.tokenType || "Bearer",
        ...userResponse.data,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Login failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function refreshOAuthToken(
  refreshToken: string | null,
): Promise<ApiResponse<TokenResponse>> {
  try {
    const response = await fetch("/api/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grantType: "refresh_token",
        refreshToken: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errorDescription || data.error || "Token refresh failed",
      );
    }

    return {
      status: true,
      data: {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        expiresIn: data.data.expiresIn,
        tokenType: data.data.tokenType || "Bearer",
        idToken: data.data.idToken,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] OAuth token refresh failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function getOAuthUserInfo(
  accessToken: string,
): Promise<ApiResponse<UserInfo>> {
  try {
    const response = await fetch("/api/oauth/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errorDescription || data.error || "Failed to fetch user info",
      );
    }

    console.log("[ClientAPI] Fetched OAuth user info:", data);

    return {
      status: true,
      data: data,
    };
  } catch (error) {
    console.error("[ClientAPI] Failed to fetch OAuth user info:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function revokeOAuthToken(
  token: string,
  tokenTypeHint?: "access_token" | "refresh_token",
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch("/api/oauth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        tokenTypeHint,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errorDescription || data.error || "Token revocation failed",
      );
    }

    return {
      status: true,
      message: data.message || "Token revoked successfully",
    };
  } catch (error) {
    console.error("[ClientAPI] Token revocation failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function validateToken(
  token: string,
  tokenType: "access_token" | "refresh_token",
): Promise<ApiResponse<TokenValidationResponse>> {
  try {
    const response = await fetch("/api/auth/validate-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        tokenType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Token validation failed");
    }

    console.log("[ClientAPI] Token validation response:", data);

    return {
      status: true,
      data: {
        isValid: data.data.isValid,
        tokenType: data.data.tokenType,
        message: data.message,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Token validation failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function updateUserProfile(
  accessToken: string,
  profileData: UpdateProfileRequest,
): Promise<ApiResponse<UserInfo>> {
  try {
    const response = await fetch("/api/auth/update-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Profile update failed");
    }

    console.log("[ClientAPI] Fetched user profile update data:", data);

    return {
      status: true,
      data: data,
      message: "Profile updated successfully",
    };
  } catch (error) {
    console.error("[ClientAPI] Profile update failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch("/api/auth/reset-password/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: encryptAES(email) }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send reset email");
    }

    console.log("[ClientAPI] Fetched password reset email data:", data);

    return {
      status: true,
      data: { message: data.message || "Reset email sent successfully" },
    };
  } catch (error) {
    console.error("[ClientAPI] Send reset email failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function sendPasswordResetSms(
  phoneNumber: string,
): Promise<ApiResponse<PasswordResetSmsResponse>> {
  try {
    const response = await fetch("/api/auth/reset-password/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber: encryptAES(phoneNumber) }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send SMS");
    }

    console.log("[ClientAPI] Fetched SMS reset data:", data);

    return {
      status: true,
      data: {
        message: data.message,
        maskedOtp: data.maskedOtp,
        expiresInMinutes: data.expiresInMinutes,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Send SMS failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function validateSmsOtp(
  phoneNumber: string,
  otpCode: string,
): Promise<ApiResponse<ValidateSmsOtpResponse>> {
  try {
    const response = await fetch("/api/auth/reset-password/sms/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: encryptAES(phoneNumber),
        otpCode: encryptAES(otpCode),
      }),
    });

    const data = await response.json();

    console.log("[ClientAPI] Fetched OTP validation data:", data);

    if (!response.ok) {
      throw new Error(data.message || "OTP validation failed");
    }

    return {
      status: true,
      data: {
        message: data.data.message,
        passwordToken: data.data.passwordToken,
        tokenExpiresInMinutes: data.data.tokenExpiresInMinutes,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] OTP validation failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function resetPassword(
  passwordToken: string,
  newPassword: string,
  reNewPassword: string,
  resetProvider: ResetProvider,
): Promise<ApiResponse<{ message: string }>> {
  try {
    console.log(
      "[ClientAPI] Resetting password with token:",
      passwordToken,
      "and provider:",
      resetProvider,
    );
    const response = await fetch("/api/auth/reset-password/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-reset-provider": resetProvider,
      },
      body: JSON.stringify({
        passwordToken,
        newPassword: encryptAES(newPassword),
        reNewPassword: encryptAES(reNewPassword),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Password reset failed");
    }

    return {
      status: true,
      data: { message: data.message || "Password reset successful" },
    };
  } catch (error) {
    console.error("[ClientAPI] Password reset failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function getUserProfile(
  accessToken: string,
): Promise<ApiResponse<UserProfileData>> {
  try {
    const response = await fetch("/api/auth/me/profile", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user profile");
    }

    console.log("[ClientAPI] Fetched user profile:", data);

    return {
      status: true,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Failed to fetch user profile:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function getUserWorks(
  accessToken: string,
): Promise<ApiResponse<UserWorkInfo[]>> {
  try {
    const response = await fetch("/api/auth/me/works", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user works");
    }

    console.log("[ClientAPI] Fetched user works:", data);

    return {
      status: true,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Failed to fetch user works:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function getUserUam(
  accessToken: string,
  workId?: number | null,
  uamAolId?: number | null,
): Promise<ApiResponse<UserUamWorkInfo[] | UserUamWorkInfo>> {
  try {
    let url = "/api/auth/me/uam";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user UAM data");
    }

    console.log("[ClientAPI] Fetched user UAM data:", data);

    return {
      status: true,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Failed to fetch user UAM data:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function sendPasswordResetEmailOtp(
  email: string,
): Promise<ApiResponse<PasswordResetEmailOtpResponse>> {
  try {
    const response = await fetch("/api/auth/reset-password/email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: encryptAES(email) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to send email OTP");
    console.log("[ClientAPI] Fetched email OTP reset data:", data);
    return {
      status: true,
      data: {
        message: data.data?.message || data.message,
        expiresInMinutes: data.data?.expiresInMinutes,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Send email OTP failed:", error);
    return { status: false, error: (error as Error).message };
  }
}

export async function validateEmailOtp(
  email: string,
  otpCode: string,
): Promise<ApiResponse<ValidateEmailOtpResponse>> {
  try {
    const response = await fetch(
      "/api/auth/reset-password/email-otp/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: encryptAES(email),
          otpCode: encryptAES(otpCode),
        }),
      },
    );
    const data = await response.json();
    console.log("[ClientAPI] Fetched email OTP validation data:", data);
    if (!response.ok)
      throw new Error(data.message || "Email OTP validation failed");
    return {
      status: true,
      data: {
        message: data.data.message,
        passwordToken: data.data.passwordToken,
        tokenExpiresInMinutes: data.data.tokenExpiresInMinutes,
      },
    };
  } catch (error) {
    console.error("[ClientAPI] Email OTP validation failed:", error);
    return { status: false, error: (error as Error).message };
  }
}

export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
  passwordType?: number,
): Promise<ApiResponse<{ message: string }>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    // Add optional password type header
    if (![null, undefined, "", 0].includes(passwordType)) {
      headers["x-password-type"] = String(passwordType);
    }
    console.log("[ClientAPI] Changing password with headers:", headers);
    console.log("[ClientAPI] Changing password with body:", {
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentPassword: encryptAES(currentPassword),
        newPassword: encryptAES(newPassword),
        confirmNewPassword: encryptAES(confirmNewPassword),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Password change failed");
    }

    return {
      status: true,
      data: { message: data.message || "Password changed successfully" },
      message: data.message,
    };
  } catch (error) {
    console.error("[ClientAPI] Password change failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}
