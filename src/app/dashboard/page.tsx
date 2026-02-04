"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { UserProfile } from "@/components/molecules";
import { Header } from "@/components/organisms";
import { validateToken, updateUserProfile } from "@/lib/client-api";
import { storageKeys } from "@/config";

export default function DashboardPage() {
  const { isAuthenticated, user, logout, fetchUserDetails, refreshToken } =
    useAuth();
  const router = useRouter();
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isValidatingAccess, setIsValidatingAccess] = useState(false);
  const [isValidatingRefresh, setIsValidatingRefresh] = useState(false);
  const [accessTokenValidation, setAccessTokenValidation] = useState<
    string | null
  >(null);
  const [refreshTokenValidation, setRefreshTokenValidation] = useState<
    string | null
  >(null);

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phoneNumber: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    if (user) {
      setProfileForm({
        fullName: user.name || "",
        phoneNumber: user.phoneNumber || "",
      });
    } else {
      loadUserDetails();
    }
  }, [isAuthenticated, router, user]);

  const loadUserDetails = async () => {
    setIsLoadingUser(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const userData = await fetchUserDetails();
      if (userData) {
        setProfileForm({
          fullName: userData.name || "",
          phoneNumber: userData.phoneNumber || "",
        });
      } else {
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
      router.push("/");
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshingToken(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const success = await refreshToken();
      if (success) {
        setSuccessMessage("Token refreshed successfully!");
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

  const handleValidateAccessToken = async () => {
    setIsValidatingAccess(true);
    setAccessTokenValidation(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = localStorage.getItem(storageKeys.accessToken);
      if (!accessToken) {
        setAccessTokenValidation("❌ No access token found");
        return;
      }

      const result = await validateToken(accessToken, "access");

      console.log("Access token validation result:", result);
      if (result.status && result.data) {
        if (result.data.isValid) {
          setAccessTokenValidation(
            `✅ Access token is valid${result.data.message ? ` - ${result.data.message}` : ""}`,
          );
          setSuccessMessage("Access token is valid!");
        } else {
          setAccessTokenValidation(
            `❌ Access token is invalid${result.data.message ? ` - ${result.data.message}` : ""}`,
          );
          setError("Access token is invalid");
        }
        return;
      }

      setAccessTokenValidation(
        "❌ Validation failed: " + (result.error || "Unknown error"),
      );
      setError(result.error || "Validation failed");
    } catch (err) {
      console.error("[Dashboard] Access token validation failed:", err);
      setAccessTokenValidation(
        "❌ Validation error: " + (err as Error).message,
      );
      setError("Validation failed: " + (err as Error).message);
    } finally {
      setIsValidatingAccess(false);
    }
  };

  const handleValidateRefreshToken = async () => {
    setIsValidatingRefresh(true);
    setRefreshTokenValidation(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const refreshTokenValue = localStorage.getItem(storageKeys.refreshToken);
      if (!refreshTokenValue) {
        setRefreshTokenValidation("❌ No refresh token found");
        return;
      }

      const result = await validateToken(refreshTokenValue, "refresh");

      if (result.status && result.data) {
        if (result.data.isValid) {
          setRefreshTokenValidation(
            `✅ Refresh token is valid${result.data.message ? ` - ${result.data.message}` : ""}`,
          );
          setSuccessMessage("Refresh token is valid!");
        } else {
          setRefreshTokenValidation(
            `❌ Refresh token is invalid${result.data.message ? ` - ${result.data.message}` : ""}`,
          );
          setError("Refresh token is invalid");
        }
      } else {
        setRefreshTokenValidation(
          "❌ Validation failed: " + (result.error || "Unknown error"),
        );
        setError(result.error || "Validation failed");
      }
    } catch (err) {
      console.error("[Dashboard] Refresh token validation failed:", err);
      setRefreshTokenValidation(
        "❌ Validation error: " + (err as Error).message,
      );
      setError("Validation failed: " + (err as Error).message);
    } finally {
      setIsValidatingRefresh(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = localStorage.getItem(storageKeys.accessToken);
      if (!accessToken) {
        setError("No access token found");
        return;
      }

      const result = await updateUserProfile(accessToken, {
        fullName: profileForm.fullName,
        phoneNumber: profileForm.phoneNumber,
      });

      if (result.status && result.data) {
        setSuccessMessage("Profile updated successfully!");
        setShowUpdateForm(false);
        // Reload user data to show updated info
        await loadUserDetails();
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("[Dashboard] Profile update failed:", err);
      setError("Failed to update profile: " + (err as Error).message);
    } finally {
      setIsUpdatingProfile(false);
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

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {successMessage}
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

            <Card>
              <h2 className="text-xl font-bold mb-4">Token Validation</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex gap-3 mb-2">
                    <Button
                      onClick={handleValidateAccessToken}
                      disabled={isValidatingAccess}
                      variant="secondary"
                    >
                      {isValidatingAccess
                        ? "Validating..."
                        : "Validate Access Token"}
                    </Button>
                    <Button
                      onClick={handleValidateRefreshToken}
                      disabled={isValidatingRefresh}
                      variant="secondary"
                    >
                      {isValidatingRefresh
                        ? "Validating..."
                        : "Validate Refresh Token"}
                    </Button>
                  </div>

                  {accessTokenValidation && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                      <strong>Access Token:</strong> {accessTokenValidation}
                    </div>
                  )}

                  {refreshTokenValidation && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                      <strong>Refresh Token:</strong> {refreshTokenValidation}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Check if your current tokens are still valid on the server.
                </p>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold mb-4">Update Profile</h2>

              {!showUpdateForm ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Update your profile information (Full Name and Phone
                    Number).
                  </p>
                  <Button onClick={() => setShowUpdateForm(true)}>
                    Edit Profile
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          fullName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phoneNumber}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          phoneNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? "Updating..." : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowUpdateForm(false);
                        // Reset form to current user data
                        if (user) {
                          setProfileForm({
                            fullName: user.name || "",
                            phoneNumber: user.phoneNumber || "",
                          });
                        }
                      }}
                      disabled={isUpdatingProfile}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
