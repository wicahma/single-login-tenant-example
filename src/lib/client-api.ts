"use client";

import { manualAuthConfig, storageKeys } from "@/config";
import {
  EPasswordSource,
  EUsernameSource,
  TokenResponse,
  RefreshMicrosoftTokenData,
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
  PreTokenLoginResponse,
  TenantLoginResponse,
} from "@/lib/types/auth";
import { encryptAES } from "@/lib/encryption";
import { isMfaRequiredError, triggerMfaRecovery } from "@/lib/msal-recovery";
import { IEnrollUserResponse } from "./types/mfa";

export interface ApiResponse<T = any> {
  status: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
  /** Set to true when the backend returned a mfa_required 401 */
  mfaRequired?: boolean;
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
  workId?: number | null,
): Promise<ApiResponse<TokenResponse>> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
        ...(workId != null ? { workId } : {}),
      }),
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

export async function exchangePreTokenForSession(
  preToken: string,
): Promise<ApiResponse<TokenResponse & UserInfo>> {
  try {
    const preTokenResponse = await claimPreToken(preToken);

    if (!preTokenResponse.status || !preTokenResponse.data) {
      throw new Error("Failed to fetch user info after login");
    }

    const userResponse = await getUserDetails(
      preTokenResponse.data.accessToken,
    );

    if (!userResponse.status || !userResponse.data) {
      throw new Error("Failed to fetch user info after login");
    }

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
  } catch (error) {
    console.error("[ClientAPI] Pre-token exchange failed:", error);
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
): Promise<ApiResponse<any>> {
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

    let data: ApiResponse<PreTokenLoginResponse | TenantLoginResponse> =
      await response.json();

    if (!response.ok || !data.status || !data.data) {
      throw new Error(data.message || "Login failed");
    }

    console.log("[ClientAPI] Login successful, fetching user info...", data);

    if (responseType === "pre-token") {
      const mfaEnrollment = (data.data as PreTokenLoginResponse).mfaEnrollment;
      if (mfaEnrollment?.requiredToMFA) {
        console.warn(
          `[ClientAPI] MFA is required. Reason: ${mfaEnrollment.reason}`,
        );

        localStorage.setItem(
          "preToken",
          (data.data as PreTokenLoginResponse).preToken,
        );

        return {
          status: true,
          data: {
            ...(data.data as PreTokenLoginResponse),
          },
        };

        // set pretoken in the client
        // directly call the verify mfa or enroll then verify setup mfa based on the isenrolled
        // if the flow is done, then continue to claim pretoken and fetch user info, otherwise return with mfa required error to trigger mfa flow in the login page

        // return null as any;
      }

      console.log("Pre token requested!", data);
      const preTokenSession = await exchangePreTokenForSession(
        (data.data as PreTokenLoginResponse).preToken,
      );

      if (!preTokenSession.status || !preTokenSession.data) {
        throw new Error(
          preTokenSession.error || "Failed to fetch user info after login",
        );
      }

      console.log("Pre-token login response:", preTokenSession);

      return preTokenSession;
    }

    const userResponse = await getUserDetails(
      (data.data as TenantLoginResponse).accessToken,
    );

    if (!userResponse.status || !userResponse.data) {
      throw new Error("Failed to fetch user info after login");
    }

    // // Handle Microsoft MFA requirement
    // let microsoftMfaRequired = data.data.microsoftMfaRequired ?? false;
    // let resolvedMsAccessToken: string | null =
    //   data.data.microsoftAccessToken ?? null;
    // let resolvedMsExpiresIn = data.data.microsoftExpiresIn ?? 0;

    // if (microsoftMfaRequired) {
    //   try {
    //     const recoveredToken = await triggerMfaRecovery(data.data.accessToken);
    //     // triggerMfaRecovery already persisted the token to localStorage;
    //     // read back the expiry so AuthContext can set up the refresh timer.
    //     const msExpiresAt = localStorage.getItem(
    //       storageKeys.microsoftExpiresAt,
    //     );
    //     resolvedMsAccessToken = recoveredToken;
    //     resolvedMsExpiresIn = msExpiresAt
    //       ? Math.max(0, Math.floor((Number(msExpiresAt) - Date.now()) / 1000))
    //       : 0;
    //     microsoftMfaRequired = false; // recovery succeeded — no warning needed
    //   } catch (err) {
    //     // User dismissed the popup or popup was blocked.
    //     // Log it — Graph-dependent features will degrade gracefully.
    //     console.warn(
    //       "[Microsoft] MFA recovery skipped or failed at login time.",
    //       err,
    //     );
    //     // microsoftMfaRequired remains true so the login page can show a warning
    //   }
    // }

    return {
      status: true,
      data: {
        accessToken: (data.data as TenantLoginResponse).accessToken,
        refreshToken: (data.data as TenantLoginResponse).refreshToken,
        expiresIn: (data.data as TenantLoginResponse).expiresIn,
        tokenType: (data.data as TenantLoginResponse).tokenType || "Bearer",
        // microsoftAccessToken: resolvedMsAccessToken,
        // microsoftExpiresIn: resolvedMsExpiresIn,
        // microsoftMfaRequired,
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

export async function users(): Promise<
  ApiResponse<{ status: string; message: string; data: any }>
> {
  try {
    const response = await fetch("/api/auth/users", {
      method: "GET",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch users");
    }

    console.log("[ClientAPI] Fetched users data:", data);

    return {
      status: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    console.error("[ClientAPI] Fetch users failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

// ---------------------------------------------------------------------------
// Microsoft session helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a valid, non-expired Microsoft access token is present.
 * Use this as a feature gate before rendering Graph-dependent UI.
 */
export function isMicrosoftSessionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const available = localStorage.getItem(storageKeys.msSessionAvailable);
  const token = localStorage.getItem(storageKeys.microsoftAccessToken);
  const expiresAt = localStorage.getItem(storageKeys.microsoftExpiresAt);
  return (
    available === "true" &&
    !!token &&
    Date.now() < parseInt(expiresAt ?? "0", 10)
  );
}

/**
 * Calls the backend proxy to silently exchange the stored Microsoft refresh
 * token for a fresh access token. Never calls Microsoft directly.
 */
export async function refreshMicrosoftToken(
  iamAccessToken: string,
): Promise<ApiResponse<RefreshMicrosoftTokenData>> {
  try {
    const response = await fetch("/api/auth/refresh-microsoft-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${iamAccessToken}`,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      // Detect the special mfa_required 401 shape — NOT wrapped in RBaseResponse
      if (response.status === 401 && isMfaRequiredError(data)) {
        return {
          status: false,
          mfaRequired: true,
          error: data.message,
        };
      }
      const err = new Error(data.message || "Microsoft token refresh failed");
      (err as any).httpStatus = response.status;
      throw err;
    }

    return {
      status: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    console.error("[ClientAPI] Microsoft token refresh failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Wrapper for Microsoft Graph API calls.
 * Reads the stored microsoft_access_token, attaches it, and handles:
 *   - 401 → one silent refresh + retry
 *   - 403 → scope missing (User.Read / Sites.Read.All not consented)
 * Throws with message 'NO_MS_TOKEN', 'MS_TOKEN_REFRESH_FAILED', or
 * 'MS_SCOPE_MISSING' so callers can react uniformly.
 */
export async function callGraphAPI<T = any>(
  endpoint: string,
  iamAccessToken: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const msToken = localStorage.getItem(storageKeys.microsoftAccessToken);

  if (!msToken || !isMicrosoftSessionAvailable()) {
    throw Object.assign(new Error("NO_MS_TOKEN"), { httpStatus: 0 });
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      Authorization: `Bearer ${msToken}`,
    },
  });

  // Expired mid-session — attempt one silent refresh then retry
  if (response.status === 401 && !_retried) {
    const refreshResult = await refreshMicrosoftToken(iamAccessToken);

    if (refreshResult.mfaRequired) {
      // Silent refresh hit an MFA requirement — launch MSAL interactive popup
      let newAccessToken: string;
      try {
        newAccessToken = await triggerMfaRecovery(iamAccessToken);
      } catch (recoveryError) {
        // Recovery failed or user cancelled — surface as a distinct error
        throw Object.assign(
          new Error(
            `MS_MFA_RECOVERY_FAILED: ${(recoveryError as Error).message}`,
          ),
          { httpStatus: 401, mfaRequired: true },
        );
      }
      // Token stored in localStorage by triggerMfaRecovery; retry once
      return callGraphAPI<T>(endpoint, iamAccessToken, options, true);
    }

    if (!refreshResult.status || !refreshResult.data) {
      throw Object.assign(new Error("MS_TOKEN_REFRESH_FAILED"), {
        httpStatus: 401,
      });
    }

    localStorage.setItem(
      storageKeys.microsoftAccessToken,
      refreshResult.data.access_token,
    );
    localStorage.setItem(
      storageKeys.microsoftExpiresAt,
      (Date.now() + refreshResult.data.expires_in * 1000).toString(),
    );
    localStorage.setItem(storageKeys.msSessionAvailable, "true");

    return callGraphAPI<T>(endpoint, iamAccessToken, options, true);
  }

  if (response.status === 403) {
    throw Object.assign(new Error("MS_SCOPE_MISSING"), { httpStatus: 403 });
  }

  if (!response.ok) {
    throw Object.assign(new Error(`Graph API error: ${response.status}`), {
      httpStatus: response.status,
    });
  }

  return response.json() as Promise<T>;
}

export async function enrollMFA(
  userIdentifier: string,
  userName: string,
): Promise<ApiResponse<IEnrollUserResponse>> {
  try {
    console.log(
      "[ClientAPI] Starting MFA enrollment for user:",
      userIdentifier,
      userName,
    );

    const response = await fetch("/api/mfa/enroll", {
      method: "POST",
      body: JSON.stringify({
        userIdentifier: userIdentifier,
        userName: userName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[ClientAPI] Enroll MFA failed with response:", data);
      throw new Error(data.message || "Enroll MFA failed");
    }

    console.log(
      "[ClientAPI] Enroll MFA successful, fetching user info...",
      data,
    );

    return {
      status: true,
      message: data.message,
      data: data.data,
    };
  } catch (error) {
    console.error("[ClientAPI] Enroll MFA failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function verifyMFA(
  userIdentifier: string,
  token: string,
  preToken: string,
  fingerprint?: string,
  userAgent?: string,
): Promise<ApiResponse<null>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-fingerprint": fingerprint || "",
      "x-pre-token": preToken,
      "user-agent": userAgent || "",
    };

    console.log(
      "[ClientAPI] Starting MFA verify for user:",
      userIdentifier,
      preToken,
    );

    console.log("[ClientAPI] Attempting verify MFA with headers:", headers);

    const response = await fetch("/api/mfa/verify", {
      method: "POST",
      headers,
      body: JSON.stringify({
        userIdentifier: userIdentifier,
        token: token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Verify MFA failed");
    }

    console.log(
      "[ClientAPI] Verify MFA successful, fetching user info...",
      data,
    );

    return {
      status: true,
      message: data.message,
      data: null,
    };
  } catch (error) {
    console.error("[ClientAPI] Verify MFA failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function verifyRecoveryMFA(
  userIdentifier: string,
  recoveryCode: string,
): Promise<ApiResponse<null>> {
  try {
    console.log(
      "[ClientAPI] Starting MFA recovery verify for user:",
      userIdentifier,
      recoveryCode,
    );

    const response = await fetch("/api/mfa/verify-recovery", {
      method: "POST",
      // headers,
      body: JSON.stringify({
        userIdentifier: userIdentifier,
        recoveryCode: recoveryCode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Verify recovery MFA failed");
    }

    console.log(
      "[ClientAPI] Verify recovery MFA successful, fetching user info...",
      data,
    );

    return {
      status: true,
      message: data.message,
      data: null,
    };
  } catch (error) {
    console.error("[ClientAPI] Verify recovery MFA failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

export async function verifySetupMFA(
  userIdentifier: string,
  token: string,
  fingerprint?: string,
  preToken?: string,
  userAgent?: string,
): Promise<ApiResponse<null>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-fingerprint": fingerprint || "",
      "x-pre-token": preToken || "",
      "user-agent": userAgent || "",
    };

    console.log(
      "[ClientAPI] Starting MFA setup verify for user:",
      userIdentifier,
      token,
    );

    const response = await fetch("/api/mfa/verify-setup", {
      method: "POST",
      headers,
      body: JSON.stringify({
        userIdentifier: userIdentifier,
        token: token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Verify setup MFA failed");
    }

    console.log(
      "[ClientAPI] Verify setup MFA successful, fetching user info...",
      data,
    );

    return {
      status: true,
      message: data.message,
      data: null,
    };
  } catch (error) {
    console.error("[ClientAPI] Verify setup MFA failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}

/**
 * loginWithMicrosoftToken
 *
 * Sends a Microsoft ID token (obtained via MSAL.js) to the backend's
 * /public/login endpoint via the BFF proxy at /api/auth/microsoft-login.
 *
 * Unlike the password-based loginUser(), this function:
 *   - Does NOT AES-encrypt the body
 *   - Does NOT send x-username-source or x-pass-source headers
 *   - Sends the raw Microsoft ID token
 *
 * The backend validates the token cryptographically, extracts the NPK from
 * the given_name claim, looks up the user, performs UAM access checks, and
 * returns the standard TenantLoginResponse.
 */
export async function loginWithMicrosoftToken(
  idToken: string,
  provider: string = "Microsoft",
): Promise<ApiResponse<any>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    console.log("[ClientAPI] Attempting Microsoft token login");

    const response = await fetch("/api/auth/microsoft-login", {
      method: "POST",
      headers,
      body: JSON.stringify({
        microsoft_id_token: idToken,
        provider,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.status || !data.data) {
      throw new Error(data.message || "Microsoft login failed");
    }

    console.log(
      "[ClientAPI] Microsoft login successful, fetching user info...",
    );

    // Fetch user details with the returned access token
    const userResponse = await getUserDetails(data.data.accessToken);

    if (!userResponse.status || !userResponse.data) {
      throw new Error(
        userResponse.error || "Failed to fetch user info after login",
      );
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
    console.error("[ClientAPI] Microsoft login failed:", error);
    return {
      status: false,
      error: (error as Error).message,
    };
  }
}
