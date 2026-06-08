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
      const usernameSource: EUsernameSource = "Npk" as EUsernameSource;
      const passwordSource: EPasswordSource | null = null;
      const responseType: TResponseType = "pre-token";
      console.log(
        `Submitting login with username: ${username}, password: ${password}, usernameSource: ${usernameSource}, passwordSource: ${passwordSource}, responseType: ${responseType}`,
      );

      const response = await loginUser(
        username,
        password,
        usernameSource,
        passwordSource,
        responseType,
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
