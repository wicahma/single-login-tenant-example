"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { UserProfile } from "@/components/molecules";
import { Header } from "@/components/organisms";

export default function DashboardPage() {
  const { isAuthenticated, user, logout, fetchUserDetails, refreshToken } =
    useAuth();
  const router = useRouter();
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    if (!user) {
      // If authenticated but no user data, fetch it
      loadUserDetails();
    }
  }, [isAuthenticated, router]);

  const loadUserDetails = async () => {
    setIsLoadingUser(true);
    setError(null);

    try {
      const userData = await fetchUserDetails();
      if (!userData) {
        setError("Failed to load user data");
      }
    } catch (err) {
      console.error("[Dashboard] Failed to load user data:", err);
      setError("Failed to load user data: " + (err as Error).message);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("[Dashboard] Logout failed:", err);
      // Still redirect even if API call fails
      router.push("/");
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshingToken(true);
    setError(null);

    try {
      const success = await refreshToken();
      if (success) {
        // Reload user data after token refresh
        await loadUserDetails();
      } else {
        setError("Failed to refresh token");
      }
    } catch (err) {
      console.error("[Dashboard] Token refresh failed:", err);
      setError("Failed to refresh token: " + (err as Error).message);
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleRefreshUserData = async () => {
    await loadUserDetails();
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
              <h1 className="text-4xl font-bold">Manual Login Dashboard</h1>
              <p className="text-sm text-gray-500 mt-2">
                Logged in via Manual Login (Username/Password with Request
                Signing)
              </p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">
                  Secure Manual Login Active
                </p>
                <p className="text-xs text-green-600 mt-1">
                  All requests are signed with RSA-PSS. Auto token refresh
                  enabled.
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
                  <Button onClick={handleRefreshUserData}>
                    Load User Data
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    onClick={handleRefreshToken}
                    disabled={isRefreshingToken}
                  >
                    {isRefreshingToken ? "Refreshing..." : "Refresh Token"}
                  </Button>
                  <Button
                    onClick={handleRefreshUserData}
                    disabled={isLoadingUser}
                    variant="secondary"
                  >
                    {isLoadingUser ? "Loading..." : "Refresh User Data"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  <strong>Auto Token Refresh:</strong> Enabled (refreshes 5
                  minutes before expiry)
                </p>
                <p className="text-sm text-gray-500">
                  Your session is active and secure.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
