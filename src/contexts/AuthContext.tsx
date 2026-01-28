"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { storageKeys, LoginMethod } from "@/config";
import { TokenResponse, UserInfo } from "@/types/auth";
import {
  logoutUser,
  refreshAccessToken as refreshTokenApi,
  getUserDetails as getUserDetailsApi,
  revokeOAuthToken,
} from "@/lib/client-api";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  loginMethod: LoginMethod | null;
  login: (tokens: TokenResponse, user: UserInfo, method: LoginMethod) => void;
  logout: () => Promise<void>;
  updateTokens: (tokens: TokenResponse) => void;
  refreshToken: () => Promise<boolean>;
  fetchUserDetails: () => Promise<UserInfo | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
 
  const setupAutoRefresh = useCallback((expiresIn: number) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh 5 minutes before expiry (or half the expiry time, whichever is smaller)
    const refreshBuffer = Math.min(5 * 60, Math.floor(expiresIn / 2));
    const refreshTime = (expiresIn - refreshBuffer) * 1000;

    console.log(
      "[AuthContext] Auto-refresh scheduled in",
      refreshTime / 1000,
      "seconds",
    );

    refreshTimerRef.current = setTimeout(async () => {
      console.log("[AuthContext] Auto-refreshing token...");
      const success = await refreshToken();
      if (!success) {
        console.error("[AuthContext] Auto-refresh failed, logging out");
        await logout();
      }
    }, refreshTime);
  }, []);
 
  const isTokenExpiringSoon = useCallback((): boolean => {
    const expiry = localStorage.getItem(storageKeys.tokenExpiry);
    if (!expiry) return true;

    const expiryTime = Number.parseInt(expiry);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return expiryTime - now < fiveMinutes;
  }, []);
 
  useEffect(() => {
    const token = localStorage.getItem(storageKeys.accessToken);
    const userData = localStorage.getItem(storageKeys.userData);
    const expiry = localStorage.getItem(storageKeys.tokenExpiry);
    const method = localStorage.getItem(
      storageKeys.loginMethod,
    ) as LoginMethod | null;

    if (token && userData) {
      setAccessToken(token);
      setUser(JSON.parse(userData));
      setLoginMethod(method);
      setIsAuthenticated(true);

      // Setup auto-refresh if token is still valid
      if (expiry) {
        const expiryTime = Number.parseInt(expiry);
        const now = Date.now();
        const remainingSeconds = Math.floor((expiryTime - now) / 1000);

        if (remainingSeconds > 0) {
          setupAutoRefresh(remainingSeconds);
        } else {
          // Token already expired, try to refresh
          refreshToken().catch(() => {
            logout();
          });
        }
      }
    }

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [setupAutoRefresh]);
 
  const login = useCallback(
    (tokens: TokenResponse, userData: UserInfo, method: LoginMethod) => {
      localStorage.setItem(storageKeys.accessToken, tokens.accessToken);
      localStorage.setItem(storageKeys.refreshToken, tokens.refreshToken);
      localStorage.setItem(storageKeys.userData, JSON.stringify(userData));
      localStorage.setItem(storageKeys.loginMethod, method);

      const expiryTime = Date.now() + tokens.expiresIn * 1000;
      localStorage.setItem(storageKeys.tokenExpiry, expiryTime.toString());

      setAccessToken(tokens.accessToken);
      setUser(userData);
      setLoginMethod(method);
      setIsAuthenticated(true);

      // Setup auto-refresh
      setupAutoRefresh(tokens.expiresIn);

      console.log(
        "[AuthContext] Session stored, expires in",
        tokens.expiresIn,
        "seconds",
      );
    },
    [setupAutoRefresh],
  );
 
  const logout = useCallback(async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const storedMethod = localStorage.getItem(
      storageKeys.loginMethod,
    ) as LoginMethod | null;
    const storedRefreshToken = localStorage.getItem(storageKeys.refreshToken);

    // Call appropriate logout API based on login method
    if (accessToken) {
      try {
        if (storedMethod === "oauth" && storedRefreshToken) {
          // Revoke OAuth refresh token
          await revokeOAuthToken(storedRefreshToken, "refresh_token");
          console.log("[AuthContext] OAuth token revoked successfully");
        } else {
          // Manual login logout
          await logoutUser(accessToken);
          console.log("[AuthContext] Logout API called successfully");
        }
      } catch (error) {
        console.error("[AuthContext] Logout/revoke failed:", error);
        // Continue with local cleanup even if API fails
      }
    }

    // Clear all stored data
    localStorage.removeItem(storageKeys.accessToken);
    localStorage.removeItem(storageKeys.refreshToken);
    localStorage.removeItem(storageKeys.userData);
    localStorage.removeItem(storageKeys.tokenExpiry);
    localStorage.removeItem(storageKeys.loginMethod);

    setAccessToken(null);
    setUser(null);
    setLoginMethod(null);
    setIsAuthenticated(false);

    console.log("[AuthContext] Session cleared");
  }, [accessToken]);
 
  const updateTokens = useCallback(
    (tokens: TokenResponse) => {
      localStorage.setItem(storageKeys.accessToken, tokens.accessToken);
      localStorage.setItem(storageKeys.refreshToken, tokens.refreshToken);

      const expiryTime = Date.now() + tokens.expiresIn * 1000;
      localStorage.setItem(storageKeys.tokenExpiry, expiryTime.toString());

      setAccessToken(tokens.accessToken);

      // Setup auto-refresh
      setupAutoRefresh(tokens.expiresIn);
    },
    [setupAutoRefresh],
  );
 
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem(storageKeys.refreshToken);

    if (!storedRefreshToken) {
      console.error("[AuthContext] No refresh token available");
      return false;
    }

    try {
      const response = await refreshTokenApi(storedRefreshToken);

      if (response.status && response.data) {
        updateTokens(response.data);
        console.log("[AuthContext] Token refreshed successfully");
        return true;
      } else {
        console.error(
          "[AuthContext] Token refresh failed:",
          response.error || response.message,
        );
        return false;
      }
    } catch (error) {
      console.error("[AuthContext] Token refresh error:", error);
      return false;
    }
  }, [updateTokens]);
 
  const fetchUserDetails = useCallback(async (): Promise<UserInfo | null> => {
    if (!accessToken) {
      console.error("[AuthContext] No access token available");
      return null;
    }

    // Check if token needs refresh
    if (isTokenExpiringSoon()) {
      console.log("[AuthContext] Token expiring soon, refreshing...");
      const success = await refreshToken();
      if (!success) {
        return null;
      }
    }

    try {
      console.log("[AuthContext] Fetching user details from API...");
      const currentToken =
        localStorage.getItem(storageKeys.accessToken) || accessToken;
      const response = await getUserDetailsApi(currentToken);

      if (response.status && response.data) {
        // Update stored user data
        localStorage.setItem(
          storageKeys.userData,
          JSON.stringify(response.data),
        );
        setUser(response.data);
        console.log("[AuthContext] User details fetched successfully");
        return response.data;
      } else {
        console.error(
          "[AuthContext] Failed to fetch user details:",
          response.error || response.message,
        );
        return null;
      }
    } catch (error) {
      console.error("[AuthContext] Error fetching user details:", error);
      return null;
    }
  }, [accessToken, isTokenExpiringSoon, refreshToken]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      accessToken,
      loginMethod,
      login,
      logout,
      updateTokens,
      refreshToken,
      fetchUserDetails,
    }),
    [
      isAuthenticated,
      user,
      accessToken,
      loginMethod,
      login,
      logout,
      updateTokens,
      refreshToken,
      fetchUserDetails,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
