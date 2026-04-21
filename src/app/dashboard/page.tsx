"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { UserProfile } from "@/components/molecules";
import { Header } from "@/components/organisms";
import {
  validateToken,
  updateUserProfile,
  changePassword,
  getUserProfile,
  getUserWorks,
  getUserUam,
} from "@/lib/client-api";
import { storageKeys } from "@/config";
import type {
  UserProfileData,
  UserWorkInfo,
  UserUamWorkInfo,
} from "@/lib/types/auth";

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

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    passwordType: undefined as number | undefined,
  });

  // --- New Public API state ---
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [userWorks, setUserWorks] = useState<UserWorkInfo[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [workUam, setWorkUam] = useState<UserUamWorkInfo | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingWorks, setIsLoadingWorks] = useState(false);
  const [isLoadingUam, setIsLoadingUam] = useState(false);
  const [worksError, setWorksError] = useState<string | null>(null);
  const [uamError, setUamError] = useState<string | null>(null);

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
      loadPublicApiData();
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
        loadPublicApiData();
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

  const loadPublicApiData = async () => {
    const accessToken = localStorage.getItem(storageKeys.accessToken);
    if (!accessToken) return;

    setIsLoadingProfile(true);
    setIsLoadingWorks(true);
    setWorksError(null);

    const [profileResult, worksResult] = await Promise.all([
      getUserProfile(accessToken),
      getUserWorks(accessToken),
    ]);

    console.log("Profile API result:", profileResult);
    console.log("Works API result:", worksResult);

    if (profileResult.status && profileResult.data) {
      setUserProfile(profileResult.data);
    }
    setIsLoadingProfile(false);

    if (worksResult.status && worksResult.data) {
      setUserWorks(worksResult.data);
    } else {
      setWorksError(worksResult.error || "Failed to load works");
    }
    setIsLoadingWorks(false);
  };

  const handleSelectWork = async (
    workId: number | null,
    uamAolId: number | null,
  ) => {
    const accessToken = localStorage.getItem(storageKeys.accessToken);
    if (!accessToken) return;

    if (workId) {
      setSelectedWorkId(workId);
    } else {
      setSelectedWorkId(uamAolId);
    }
    setWorkUam(null);
    setUamError(null);
    setIsLoadingUam(true);

    try {
      const result = await getUserUam(accessToken, workId, uamAolId);
      if (result.status && result.data) {
        // Single object when workId is provided
        console.log(
          "UAM API result for workId",
          workId,
          ":",
          "uamAolId",
          uamAolId,
          result,
        );
        setWorkUam(result.data as UserUamWorkInfo);
      } else {
        setUamError(
          result.error || "No UAM data found for this work assignment",
        );
      }
    } catch (err) {
      setUamError("Failed to load UAM data: " + (err as Error).message);
    } finally {
      setIsLoadingUam(false);
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

      const result = await validateToken(accessToken, "access_token");

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

      const result = await validateToken(refreshTokenValue, "refresh_token");

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = localStorage.getItem(storageKeys.accessToken);
      if (!accessToken) {
        setError("No access token found");
        return;
      }

      // Validate passwords match
      if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
        setError("New password and confirm password do not match");
        return;
      }

      const result = await changePassword(
        accessToken,
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmNewPassword,
        passwordForm.passwordType,
      );

      console.log("Change Pass response", result);

      if (result.status) {
        setSuccessMessage(
          result.message ||
            "Password changed successfully! You may need to login again.",
        );
        setShowChangePasswordForm(false);
        // Reset form
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
          passwordType: undefined,
        });
      } else {
        setError(result.error || "Failed to change password");
      }
    } catch (err) {
      console.error("[Dashboard] Password change failed:", err);
      setError("Failed to change password: " + (err as Error).message);
    } finally {
      setIsChangingPassword(false);
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

            <Card>
              <h2 className="text-xl font-bold mb-4">Change Password</h2>

              {!showChangePasswordForm ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Change your account password securely.
                  </p>
                  <Button onClick={() => setShowChangePasswordForm(true)}>
                    Change Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="text"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="text"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 8 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="text"
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmNewPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Type (Optional)
                    </label>
                    <input
                      type="number"
                      value={passwordForm.passwordType ?? ""}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          passwordType: e.target.value
                            ? Number.parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Leave empty if not required"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Enter an integer value if required by your
                      system
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword
                        ? "Changing Password..."
                        : "Change Password"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowChangePasswordForm(false);
                        // Reset form
                        setPasswordForm({
                          currentPassword: "",
                          newPassword: "",
                          confirmNewPassword: "",
                          passwordType: undefined,
                        });
                      }}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>

            {/* ── User Profile (Public API) ── */}
            <Card>
              <h2 className="text-xl font-bold mb-4">
                User Profile (Public API)
              </h2>
              {isLoadingProfile && (
                <div className="flex items-center py-4">
                  <LoadingSpinner />
                  <span className="ml-3 text-gray-600">Loading profile...</span>
                </div>
              )}
              {!isLoadingProfile && userProfile && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      ["ID", userProfile.id],
                      ["Full Name", userProfile.fullName],
                      ["Email", userProfile.email],
                      ["Phone", userProfile.phoneNumber],
                      ["NPK", userProfile.npk],
                    ] as [string, string | number][]
                  ).map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {label}
                      </p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                  {userProfile.application && (
                    <div className="bg-slate-50 rounded p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Application
                      </p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {userProfile.application.appName}{" "}
                        <span className="text-xs text-gray-500">
                          ({userProfile.application.appIdentifier})
                        </span>{" "}
                        <span
                          className={`text-xs font-semibold ${
                            userProfile.application.isActive
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {userProfile.application.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!isLoadingProfile && !userProfile && (
                <p className="text-gray-500 text-sm">No profile data loaded.</p>
              )}
            </Card>

            {/* ── User Works ── */}
            <Card>
              <h2 className="text-xl font-bold mb-4">User Works</h2>
              {isLoadingWorks && (
                <div className="flex items-center py-4">
                  <LoadingSpinner />
                  <span className="ml-3 text-gray-600">Loading works...</span>
                </div>
              )}
              {!isLoadingWorks && worksError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {worksError}
                </div>
              )}
              {!isLoadingWorks && !worksError && userWorks.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No work assignments found.
                </p>
              )}
              {!isLoadingWorks && !worksError && userWorks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-3">
                    Select a work assignment to view UAM details.
                  </p>
                  {userWorks.map((work, idx) => {
                    const isSelected = selectedWorkId === work.workId;
                    const isAolOnly = work.workId === null;
                    return (
                      <button
                        key={work.workId ?? `aol-${idx}`}
                        type="button"
                        onClick={() => {
                          console.log("Selected work:", work);
                          handleSelectWork(work.workId, work.uamAolId);
                        }}
                        className={`w-full text-left rounded-lg border p-4 transition-all ${
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">
                                {work.workId} {work.position.id}{" "}
                                {work.position.name}
                              </span>
                              {isAolOnly && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                  AOL-sourced
                                </span>
                              )}
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  work.isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {work.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {work.branch.id} {work.branch.name}
                              {work.company.name
                                ? ` · ${work.company.id} ${work.company.name}`
                                : ""}
                              {work.department.name
                                ? ` · ${work.department.id} ${work.department.name}`
                                : ""}
                            </p>
                            {work.group && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Group: {work.group.groupName}{" "}
                                <span className="italic">
                                  ({work.group.groupSourceName})
                                </span>
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-blue-600 text-xs font-semibold shrink-0">
                              Selected
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* ── UAM Details ── */}
            {selectedWorkId !== null && (
              <Card>
                <h2 className="text-xl font-bold mb-4">UAM Details</h2>
                {isLoadingUam && (
                  <div className="flex items-center py-4">
                    <LoadingSpinner />
                    <span className="ml-3 text-gray-600">
                      Loading UAM data...
                    </span>
                  </div>
                )}
                {!isLoadingUam && uamError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {uamError}
                  </div>
                )}
                {!isLoadingUam && !uamError && workUam && (
                  <div className="space-y-6">
                    {/* Work summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(
                        [
                          ["Position", workUam.position?.name || "-"],
                          ["Branch", workUam.branch?.name || "-"],
                          ["Department", workUam.department?.name || "—"],
                          ["Company", workUam.company?.name || "—"],
                          ["Group", workUam.group?.groupName ?? "—"],
                          ["Expires At", workUam.expiredAt ?? "Never"],
                        ] as [string, string][]
                      ).map(([label, value]) => (
                        <div key={label} className="bg-slate-50 rounded p-3">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {label}
                          </p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* UAM permissions */}
                    {workUam.uamData ? (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                          UAM Permissions
                        </h3>
                        {workUam.uamData.menuInfo &&
                        workUam.uamData.menuInfo.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                              <thead className="bg-gray-50">
                                <tr>
                                  {[
                                    "Menu",
                                    "View",
                                    "Create",
                                    "Edit",
                                    "Delete",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {workUam.uamData.menuInfo.map((menu) => (
                                  <tr
                                    key={menu.menuId}
                                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                                  >
                                    <td className="px-3 py-2 font-medium text-gray-800">
                                      {menu.menuName}
                                    </td>
                                    {(
                                      [
                                        ["view", menu.isView],
                                        ["create", menu.isCreate],
                                        ["edit", menu.isEdit],
                                        ["delete", menu.isDelete],
                                      ] as [string, boolean][]
                                    ).map(([permKey, perm]) => (
                                      <td key={permKey} className="px-3 py-2">
                                        <span
                                          className={`inline-block w-5 h-5 rounded-full text-center text-xs leading-5 font-bold ${
                                            perm
                                              ? "bg-green-100 text-green-700"
                                              : "bg-gray-100 text-gray-400"
                                          }`}
                                        >
                                          {perm ? "✓" : "✗"}
                                        </span>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            No menu permissions assigned.
                          </p>
                        )}

                        {/* Detail data */}
                        {workUam.uamData.detailData &&
                          Object.keys(workUam.uamData.detailData).length >
                            0 && (
                            <div className="mt-4">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                UAM Detail Fields
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(workUam.uamData.detailData).map(
                                  ([label, value]) => (
                                    <div
                                      key={label}
                                      className="bg-slate-50 rounded p-3"
                                    >
                                      <p className="text-xs text-gray-500">
                                        {label}
                                      </p>
                                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                                        {value}
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-700 text-sm">
                        No UAM record found for this work assignment in the
                        current application.
                      </div>
                    )}

                    {/* AOL detail */}
                    {workUam.aolDetail && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                          AOL User Detail
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(
                            [
                              ["AOL ID", workUam.aolDetail.idUser],
                              ["Name", workUam.aolDetail.nameUser],
                              ["Group", workUam.aolDetail.groupUser ?? "—"],
                              ["NPK", workUam.aolDetail.npk ?? "—"],
                              ["Email", workUam.aolDetail.email ?? "—"],
                              ["Phone", workUam.aolDetail.phoneNumber ?? "—"],
                              ["Status", workUam.aolDetail.status ?? "—"],
                              [
                                "Active Flag",
                                workUam.aolDetail.flagActive ?? "—",
                              ],
                              [
                                "Last Login",
                                workUam.aolDetail.dateLastLogin ?? "—",
                              ],
                              [
                                "Lock Password",
                                workUam.aolDetail.flagLockPassword ?? "—",
                              ],
                            ] as [string, string][]
                          ).map(([label, value]) => (
                            <div
                              key={label}
                              className="bg-slate-50 rounded p-3"
                            >
                              <p className="text-xs text-gray-500 uppercase tracking-wide">
                                {label}
                              </p>
                              <p className="text-sm font-medium text-gray-800 mt-0.5">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
