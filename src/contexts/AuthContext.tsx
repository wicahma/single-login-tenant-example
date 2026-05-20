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
import { TokenResponse, UserInfo } from "@/lib/types/auth";
import {
  logoutUser,
  refreshAccessToken as refreshTokenApi,
  getUserDetails as getUserDetailsApi,
  revokeOAuthToken,
  refreshMicrosoftToken as refreshMicrosoftTokenApi,
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
  // Microsoft session
  isMicrosoftSessionAvailable: boolean;
  showMSBanner: boolean;
  dismissMSBanner: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Microsoft session state
  const [isMicrosoftSessionAvailable, setIsMicrosoftSessionAvailable] =
    useState(false);
  const [showMSBanner, setShowMSBanner] = useState(false);
  const msRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // -------------------------------------------------------------------------
  // Microsoft session helpers
  // -------------------------------------------------------------------------

  const handleMSRefreshError = useCallback(
    (err: Error & { httpStatus?: number }) => {
      setIsMicrosoftSessionAvailable(false);
      localStorage.setItem(storageKeys.msSessionAvailable, "false");

      const msg = err.message?.toLowerCase() ?? "";
      const status = err.httpStatus ?? 0;

      if (status === 404 || (status === 401 && msg.includes("microsoft"))) {
        // MS refresh token gone or revoked — prompt re-consent
        if (!sessionStorage.getItem("ms_banner_shown")) {
          sessionStorage.setItem("ms_banner_shown", "true");
          setShowMSBanner(true);
        }
      } else if (status === 401) {
        // IAM access token expired — force full re-login without referencing
        // `logout` (which is declared later). Clear storage and redirect.
        [
          storageKeys.accessToken,
          storageKeys.refreshToken,
          storageKeys.userData,
          storageKeys.tokenExpiry,
          storageKeys.loginMethod,
          storageKeys.microsoftAccessToken,
          storageKeys.microsoftExpiresAt,
          storageKeys.msSessionAvailable,
        ].forEach((k) => localStorage.removeItem(k));
        sessionStorage.removeItem("ms_banner_shown");
        window.location.href = "/";
      }
      // 500 / network errors: log silently, do not show banner
      console.error("[AuthContext] MS token refresh error:", err.message);
    },
    [],
  );

  const setupMSAutoRefresh = useCallback(
    (expiresInSeconds: number) => {
      if (msRefreshTimerRef.current) {
        clearTimeout(msRefreshTimerRef.current);
      }

      const BUFFER = 300; // refresh 5 minutes before expiry
      const delayMs = Math.max(0, (expiresInSeconds - BUFFER) * 1000);

      console.log(
        "[AuthContext] MS auto-refresh scheduled in",
        delayMs / 1000,
        "seconds",
      );

      msRefreshTimerRef.current = setTimeout(async () => {
        const iamToken = localStorage.getItem(storageKeys.accessToken);
        if (!iamToken) return;

        console.log("[AuthContext] Silently refreshing Microsoft token...");
        const result = await refreshMicrosoftTokenApi(iamToken);

        if (result.status && result.data) {
          localStorage.setItem(
            storageKeys.microsoftAccessToken,
            result.data.access_token,
          );
          localStorage.setItem(
            storageKeys.microsoftExpiresAt,
            (Date.now() + result.data.expires_in * 1000).toString(),
          );
          setIsMicrosoftSessionAvailable(true);
          setupMSAutoRefresh(result.data.expires_in);
          console.log("[AuthContext] Microsoft token refreshed successfully");
        } else {
          const err = Object.assign(
            new Error(result.error ?? "Microsoft token refresh failed"),
            { httpStatus: 0 },
          );
          handleMSRefreshError(err);
        }
      }, delayMs);
    },
    [handleMSRefreshError],
  );

  const dismissMSBanner = useCallback(() => {
    setShowMSBanner(false);
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

    // Hydrate Microsoft session
    const msAvailable =
      localStorage.getItem(storageKeys.msSessionAvailable) === "true";
    const msToken = localStorage.getItem(storageKeys.microsoftAccessToken);
    const msExpiresAt = localStorage.getItem(storageKeys.microsoftExpiresAt);

    if (msAvailable && msToken && msExpiresAt) {
      const msRemainingSeconds = Math.floor(
        (parseInt(msExpiresAt, 10) - Date.now()) / 1000,
      );
      if (msRemainingSeconds > 0) {
        setIsMicrosoftSessionAvailable(true);
        setupMSAutoRefresh(msRemainingSeconds);
      } else {
        // Expired on reload — mark unavailable, let next manual refresh handle it
        localStorage.setItem(storageKeys.msSessionAvailable, "false");
      }
    }

    // Show banner if it was already triggered this session
    if (sessionStorage.getItem("ms_banner_shown")) {
      setShowMSBanner(true);
    }

    // Cleanup timers on unmount
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (msRefreshTimerRef.current) clearTimeout(msRefreshTimerRef.current);
    };
  }, [setupAutoRefresh, setupMSAutoRefresh]);

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

      // Setup IAM auto-refresh
      setupAutoRefresh(tokens.expiresIn);

      // Store Microsoft session (may be absent for non-MS tenants)
      if (tokens.microsoftAccessToken) {
        localStorage.setItem(
          storageKeys.microsoftAccessToken,
          tokens.microsoftAccessToken,
        );
        localStorage.setItem(
          storageKeys.microsoftExpiresAt,
          (Date.now() + (tokens.microsoftExpiresIn ?? 0) * 1000).toString(),
        );
        localStorage.setItem(storageKeys.msSessionAvailable, "true");
        setIsMicrosoftSessionAvailable(true);
        setupMSAutoRefresh(tokens.microsoftExpiresIn ?? 0);
        console.log(
          "[AuthContext] Microsoft session stored, expires in",
          tokens.microsoftExpiresIn,
          "seconds",
        );
      } else {
        localStorage.setItem(storageKeys.microsoftAccessToken, "");
        localStorage.setItem(storageKeys.microsoftExpiresAt, "0");
        localStorage.setItem(storageKeys.msSessionAvailable, "false");
        setIsMicrosoftSessionAvailable(false);
      }

      console.log(
        "[AuthContext] Session stored, expires in",
        tokens.expiresIn,
        "seconds",
      );
    },
    [setupAutoRefresh, setupMSAutoRefresh],
  );

  const logout = useCallback(async () => {
    // Clear IAM refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    // Clear Microsoft refresh timer
    if (msRefreshTimerRef.current) {
      clearTimeout(msRefreshTimerRef.current);
      msRefreshTimerRef.current = null;
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

    // Clear all IAM stored data
    localStorage.removeItem(storageKeys.accessToken);
    localStorage.removeItem(storageKeys.refreshToken);
    localStorage.removeItem(storageKeys.userData);
    localStorage.removeItem(storageKeys.tokenExpiry);
    localStorage.removeItem(storageKeys.loginMethod);

    // Clear Microsoft stored data
    localStorage.removeItem(storageKeys.microsoftAccessToken);
    localStorage.removeItem(storageKeys.microsoftExpiresAt);
    localStorage.removeItem(storageKeys.msSessionAvailable);
    sessionStorage.removeItem("ms_banner_shown");

    setAccessToken(null);
    setUser(null);
    setLoginMethod(null);
    setIsAuthenticated(false);
    setIsMicrosoftSessionAvailable(false);
    setShowMSBanner(false);

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
      // Microsoft session
      isMicrosoftSessionAvailable,
      showMSBanner,
      dismissMSBanner,
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
      isMicrosoftSessionAvailable,
      showMSBanner,
      dismissMSBanner,
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
