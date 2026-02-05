"use client";

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
  ResetProvider,
} from "@/lib/types/auth";

export interface ApiResponse<T = any> {
  status: boolean;
  data?: T;
  message?: string;
  error?: string;
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
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

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
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user details");
    }

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

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ identifier, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    console.log(
      "[ClientAPI] Login successful, fetching user info...",
      data.data,
    );

    if (responseType === "pre-token") {
      console.log("Pre token requested!", data);
      const preTokenResponse = await claimPreToken(data.data.preToken);

      if (!preTokenResponse.status || !preTokenResponse.data) {
        throw new Error("Failed to fetch user info after login");
      }

      console.log("Pre-token login response:", preTokenResponse);

      return {
        status: true,
        data: preTokenResponse.data,
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
  tokenType: "access" | "refresh",
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

    console.log("Token validation response data in client:", data);

    if (!response.ok) {
      throw new Error(data.message || "Token validation failed");
    }

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
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send reset email");
    }

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
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send SMS");
    }

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
      body: JSON.stringify({ phoneNumber, otpCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "OTP validation failed");
    }

    return {
      status: true,
      data: {
        message: data.message,
        passwordToken: data.passwordToken,
        tokenExpiresInMinutes: data.tokenExpiresInMinutes,
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
    const response = await fetch("/api/auth/reset-password/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-reset-provider": resetProvider,
      },
      body: JSON.stringify({
        passwordToken,
        newPassword,
        reNewPassword,
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
