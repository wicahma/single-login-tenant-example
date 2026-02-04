"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ssoConfig, storageKeys, loginMethods } from "@/config";
import { Card, LoadingSpinner } from "@/components/atoms";
import { AuthSession, TokenResponse, UserInfo } from "@/lib/types/auth";
import { ApiResponse } from "@/lib/client-api";

export default function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Processing...");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const errorParam = searchParams.get("error");

        if (errorParam) {
          throw new Error(searchParams.get("error_description") || errorParam);
        }

        if (!code || !state) {
          throw new Error("Missing code or state parameter");
        }

        const sessionData = sessionStorage.getItem(storageKeys.oauthSession);
        if (!sessionData) {
          throw new Error("No session data found");
        }

        const session: AuthSession = JSON.parse(sessionData);

        if (session.state !== state) {
          throw new Error("State mismatch");
        }

        setStatus("Exchanging code for tokens...");
        const tokenResponse = await fetch("/api/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: ssoConfig.redirectUri,
            codeVerifier: session.codeVerifier,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(
            errorData.errorDescription || "Token exchange failed",
          );
        }

        const tokens: ApiResponse<TokenResponse> = await tokenResponse.json();

        if (!tokens.status || !tokens.data) {
          throw new Error("Invalid token response");
        }

        console.log("Obtained tokens:", tokens);

        setStatus("Fetching user info...");
        const userInfoResponse = await fetch("/api/oauth/userinfo", {
          headers: {
            Authorization: `Bearer ${tokens.data?.accessToken}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error("Failed to fetch user info");
        }

        const userInfo: ApiResponse<UserInfo> = await userInfoResponse.json();

        if (!userInfo.status || !userInfo.data) {
          throw new Error("Invalid user info response");
        }

        login(tokens.data, userInfo.data, loginMethods.oauth);
        sessionStorage.removeItem(storageKeys.oauthSession);

        setStatus("Success! Redirecting...");
        setTimeout(() => {
          router.push("/oauth/dashboard");
        }, 1000);
      } catch (err) {
        console.error("Callback error:", err);
        setError((err as Error).message);
      }
    };

    handleCallback();
  }, [searchParams, login, router]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <h1 className="text-2xl font-bold mb-6">OAuth Callback</h1>

          {error ? (
            <div className="text-red-600">
              <p className="font-bold mb-2">Error:</p>
              <p>{error}</p>
            </div>
          ) : (
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-600">{status}</p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
