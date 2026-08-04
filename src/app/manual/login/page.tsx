"use client";

import { Card } from "@/components/atoms";
import { LoginForm } from "@/components/molecules";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { loginUser, users } from "@/lib/client-api";
import { loginMethods, manualAuthConfig } from "@/config";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EPasswordSource,
  EUsernameSource,
  TResponseType,
} from "@/lib/types/auth";
import { tryParseJSON } from "@/lib/json";
import { getMfaNextRoute, saveMfaSession } from "../../../lib/mfa-flow";
import { checkPrivateMode, getVisitorId } from "@mfa-client/frontend";

export default function ManualLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msWarning, setMsWarning] = useState(false);
  const { login, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleSubmit = async (username: string, password: string) => {
    users();
    setIsLoading(true);
    setError(null);

    try {
      const usernameSource: EUsernameSource =
        manualAuthConfig.usernameSource as EUsernameSource;
      const passwordSource: EPasswordSource | null = null;
      const responseType: TResponseType = manualAuthConfig.responseType;
      console.log(
        `Submitting login with username: ${username}, password: ${password}, usernameSource: ${usernameSource}, passwordSource: ${passwordSource}, responseType: ${responseType}`,
      );
      const visitorId = await getVisitorId();
      const { isPrivate } = await checkPrivateMode();

      const response = await loginUser(
        username,
        password,
        usernameSource,
        passwordSource,
        responseType,
        visitorId,
        isPrivate,
      );

      console.log("Login response:", response);

      if (!response.status || !response.data) {
        throw new Error(response.error || "Login failed");
      }

      if (
        "preToken" in response.data &&
        "mfaEnrollment" in response.data &&
        response.data.mfaEnrollment?.requiredToMFA
      ) {
        saveMfaSession({
          identifier: username,
          userName: username,
          preToken: response.data.preToken,
          expiresIn: response.data.expiresIn,
          mfaEnrollment: response.data.mfaEnrollment,
        });

        router.push(getMfaNextRoute(response.data.mfaEnrollment.isEnrolledMFA));
        return;
      }

      const {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType,
        microsoftAccessToken,
        microsoftExpiresIn,
        microsoftMfaRequired,
        ...userInfo
      } = response.data;

      login(
        {
          accessToken,
          refreshToken,
          expiresIn,
          tokenType,
          microsoftAccessToken,
          microsoftExpiresIn,
        },
        userInfo,
        loginMethods.manual,
      );

      if (microsoftMfaRequired) {
        // MFA recovery was triggered inside loginUser() but the user dismissed
        // the popup — surface a soft warning before navigating.
        setMsWarning(true);
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-2xl font-bold mb-6">Manual Login</h1>
            <p className="text-gray-600 mb-6">
              Login using your username and password. Requests are signed with
              RSA-PSS.
            </p>

            {msWarning && (
              <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
                Microsoft session could not be established. Some features may be
                unavailable until you complete MFA verification.
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
                <pre>{tryParseJSON(error)}</pre>
              </div>
            )}

            <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />

            {/* Divider with "or" */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">or</span>
              </div>
            </div>

            {/* Microsoft login button */}
            <button
              onClick={() => router.push("/microsoft/login")}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 21 21"
                width="18"
                height="18"
              >
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={() => router.push("/reset-password")}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Forgot your password?
              </button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
