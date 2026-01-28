"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { UserProfile } from "@/components/molecules";
import { Header } from "@/components/organisms";
import { refreshOAuthToken, getOAuthUserInfo } from "@/lib/client-api";
import { storageKeys } from "@/config";

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  idToken?: string;
}

export default function OAuthDashboardPage() {
  const { isAuthenticated, user, logout, updateTokens } = useAuth();
  const router = useRouter();
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    // Load current token data from localStorage
    loadTokenData();
  }, [isAuthenticated, router]);

  const loadTokenData = () => {
    const accessToken = localStorage.getItem(storageKeys.accessToken);
    const refreshToken = localStorage.getItem(storageKeys.refreshToken);
    const expiry = localStorage.getItem(storageKeys.tokenExpiry);

    if (accessToken && refreshToken) {
      const expiryTime = expiry ? Number.parseInt(expiry) : 0;
      const now = Date.now();
      const remainingSeconds = Math.floor((expiryTime - now) / 1000);

      setTokenData({
        accessToken,
        refreshToken,
        expiresIn: Math.max(remainingSeconds, 0),
        tokenType: "Bearer",
      });
    }
  };

  const handleFetchUserInfo = async () => {
    setIsLoadingUser(true);
    setError(null);

    try {
      const accessToken = localStorage.getItem(storageKeys.accessToken);
      if (!accessToken) {
        throw new Error("No access token available");
      }

      const response = await getOAuthUserInfo(accessToken);

      if (response.status && response.data) {
        // Update stored user data
        console.log("[OAuth Dashboard] Fetched user info:", response.data);
        console.log(
          "[OAuth Dashboard] Updating user context and storage",
          storageKeys.userData,
        );
        localStorage.setItem(
          storageKeys.userData,
          JSON.stringify(response.data),
        );
        // Force page refresh to update user display
        // globalThis.location.reload();
      } else {
        throw new Error(response.error || "Failed to fetch user info");
      }
    } catch (err) {
      console.error("[OAuth Dashboard] Failed to fetch user info:", err);
      setError("Failed to fetch user info: " + (err as Error).message);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshingToken(true);
    setError(null);

    try {
      const refreshToken = localStorage.getItem(storageKeys.refreshToken);
      if (!refreshToken || refreshToken === "null") {
        throw new Error("No refresh token available");
      }

      const response = await refreshOAuthToken(refreshToken);

      if (response.status && response.data) {
        // Update tokens in context and localStorage
        updateTokens(response.data);

        // Reload token data display
        loadTokenData();

        console.log("[OAuth Dashboard] Token refreshed successfully");
      } else {
        throw new Error(response.error || "Token refresh failed");
      }
    } catch (err) {
      console.error("[OAuth Dashboard] Token refresh failed:", err);
      setError("Failed to refresh token: " + (err as Error).message);
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("[OAuth Dashboard] Logout failed:", err);
      // Still redirect even if API call fails
      router.push("/");
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold">OAuth Dashboard</h1>
              <p className="text-sm text-gray-500 mt-2">
                Logged in via OAuth 2.0 / OIDC
              </p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-blue-600 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">
                  OAuth Login Active
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Your session is managed by the OAuth provider. You can
                  manually refresh tokens using the buttons below.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6">
            {isLoadingUser && (
              <Card>
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                  <span className="ml-3 text-gray-600">
                    Loading user information...
                  </span>
                </div>
              </Card>
            )}
            {!isLoadingUser && user && <UserProfile user={user} />}
            {!isLoadingUser && !user && (
              <Card>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No user data available</p>
                  <Button onClick={() => router.push("/")}>
                    Return to Home
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <h2 className="text-xl font-bold mb-4">Token Information</h2>
              <div className="space-y-3">
                {tokenData && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">
                        Token Type
                      </span>
                      <span className="text-sm text-slate-900 font-mono">
                        {tokenData.tokenType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">
                        Expires In
                      </span>
                      <span className="text-sm text-slate-900">
                        {tokenData.expiresIn > 0
                          ? `${Math.floor(tokenData.expiresIn / 60)} minutes`
                          : "Expired"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">
                        Show Tokens
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setShowTokens(!showTokens)}
                      >
                        {showTokens ? "Hide" : "Show"}
                      </Button>
                    </div>
                    {showTokens && (
                      <>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            Access Token:
                          </p>
                          <code className="text-xs break-all bg-slate-800 text-slate-100 p-2 rounded block">
                            {tokenData.accessToken}
                          </code>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            Refresh Token:
                          </p>
                          <code className="text-xs break-all bg-slate-800 text-slate-100 p-2 rounded block">
                            {tokenData.refreshToken}
                          </code>
                        </div>
                        {tokenData.idToken && (
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                              ID Token:
                            </p>
                            <code className="text-xs break-all bg-slate-800 text-slate-100 p-2 rounded block">
                              {tokenData.idToken}
                            </code>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold mb-4">Session Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">
                    Authentication Method
                  </span>
                  <span className="text-sm text-slate-900 font-semibold">
                    OAuth 2.0 / OIDC
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">
                    Session Status
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600">
                    <strong>Note:</strong> OAuth sessions are managed by the
                    identity provider. Token refresh happens automatically in
                    the background.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-4">
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={handleRefreshToken}
                    disabled={isRefreshingToken}
                  >
                    {isRefreshingToken ? "Refreshing..." : "Refresh Token"}
                  </Button>
                  <Button
                    onClick={handleFetchUserInfo}
                    disabled={isLoadingUser}
                    variant="secondary"
                  >
                    {isLoadingUser ? "Loading..." : "Refresh User Data"}
                  </Button>
                  <Button onClick={() => router.push("/oauth/login")}>
                    Re-authenticate
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/")}>
                    Go to Home
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Your session is active and secure. You can manually refresh
                  tokens and user data as needed.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
