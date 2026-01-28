"use client";

import { TokenResponse, UserInfo } from "@/types/auth";

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
  usernameSource: string = "npk",
  passwordSource: string = "",
): Promise<ApiResponse<TokenResponse & UserInfo>> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-username-source": usernameSource,
        ...(passwordSource && { "x-pass-source": passwordSource }),
      },
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
