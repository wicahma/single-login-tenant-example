"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PublicClientApplication,
  type Configuration,
  type PopupRequest,
} from "@azure/msal-browser";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { loginWithMicrosoftToken } from "@/lib/client-api";
import { msalConfig as msalConfigValues, loginMethods } from "@/config";
import { tryParseJSON } from "@/lib/json";

// ---------------------------------------------------------------------------
// MSAL instance — lazy init
// ---------------------------------------------------------------------------
let _msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (_msalInstance) return _msalInstance;

  const config: Configuration = {
    auth: {
      clientId: msalConfigValues.clientId,
      authority: `https://login.microsoftonline.com/${msalConfigValues.tenantId}`,
      redirectUri: msalConfigValues.redirectUri,
    },
    cache: {
      cacheLocation: "localStorage",
    },
  };

  _msalInstance = new PublicClientApplication(config);
  return _msalInstance;
}

const loginRequest: PopupRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MicrosoftLoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleMicrosoftLogin = useCallback(async () => {
    // Validate configuration
    if (!msalConfigValues.clientId || !msalConfigValues.tenantId) {
      setError(
        "Microsoft login is not configured. Please set NEXT_PUBLIC_MICROSOFT_CLIENT_ID " +
          "and NEXT_PUBLIC_MICROSOFT_TENANT_ID in your environment variables.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Initialize MSAL and acquire ID token via popup
      const msalInstance = getMsalInstance();
      await msalInstance.initialize();

      console.log("[MicrosoftLogin] Opening MSAL popup...");
      const msalResponse = await msalInstance.loginPopup(loginRequest);
      const idToken = msalResponse.idToken;

      if (!idToken) {
        throw new Error(
          "MSAL did not return an ID token. Check your app registration.",
        );
      }

      console.log("[MicrosoftLogin] ID token acquired, sending to backend...");

      // Step 2: Send ID token to the backend via our BFF proxy
      const result = await loginWithMicrosoftToken(idToken);

      if (!result.status || !result.data) {
        throw new Error(result.error || "Microsoft login failed");
      }

      // Step 3: Extract tokens and user info
      const {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType,
        microsoftAccessToken,
        microsoftExpiresIn,
        ...userInfo
      } = result.data;

      // Step 4: Store session via AuthContext
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
        loginMethods.microsoft,
      );

      console.log("[MicrosoftLogin] Login successful, redirecting...");
      router.push("/dashboard");
    } catch (err: any) {
      // Handle MSAL-specific errors gracefully
      if (err.errorCode === "user_cancelled") {
        // User closed the popup — do nothing
        console.log("[MicrosoftLogin] User cancelled the popup");
        setIsLoading(false);
        return;
      }

      console.error("[MicrosoftLogin] Login failed:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [login, router]);

  return (
    <>
      <Header isAuthenticated={false} onLogout={() => {}} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center">
              {/* Microsoft logo */}
              <div className="mb-6 flex justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 21 21"
                  width="48"
                  height="48"
                >
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold mb-2">
                Sign in with Microsoft
              </h1>
              <p className="text-gray-600 mb-8">
                Use your Microsoft work or school account to sign in securely.
                No password needed — we&apos;ll authenticate you via Azure
                Active Directory.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-left text-sm overflow-auto">
                  {tryParseJSON(error)}
                </div>
              )}

              <Button
                onClick={handleMicrosoftLogin}
                isLoading={isLoading}
                className="w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 21 21"
                      width="20"
                      height="20"
                    >
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </Button>

              <div className="mt-6 text-sm text-gray-500">
                <p>
                  By signing in, you agree to use your organization&apos;s
                  Microsoft Entra ID credentials.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/manual/login")}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Use password login instead
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
