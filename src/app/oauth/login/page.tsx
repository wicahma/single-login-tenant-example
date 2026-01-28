"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateCodeVerifierAndChallenge,
  generateRandomString,
} from "@/lib/pkce";
import { ssoConfig, storageKeys } from "@/config";
import { Card, Button } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { AuthSession } from "@/types/auth";

export default function OAuthLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const { codeVerifier, codeChallenge } =
        await generateCodeVerifierAndChallenge();
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);

      const session: AuthSession = {
        codeVerifier,
        state,
        nonce,
      };

      sessionStorage.setItem(storageKeys.oauthSession, JSON.stringify(session));

      const params = new URLSearchParams({
        ClientId: ssoConfig.clientId,
        ResponseType: "code",
        RedirectUri: ssoConfig.redirectUri,
        Scope: ssoConfig.scopes,
        State: state,
        CodeChallenge: codeChallenge,
        CodeChallengeMethod: "S256",
        Nonce: nonce,
      });

      const url = `${ssoConfig.ssoBaseUrl}/oauth/authorize?${params.toString()}`;
      window.location.href = url;
    } catch (error) {
      console.error("Login error:", error);
      alert("Failed to initiate login");
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-2xl font-bold mb-6">OAuth 2.0 Login</h1>
            <p className="text-gray-600 mb-6">
              Click the button below to login via Single Sign-On using OAuth 2.0
              with PKCE.
            </p>
            <Button
              onClick={handleLogin}
              isLoading={isLoading}
              className="w-full"
            >
              Login with SSO
            </Button>
          </Card>

          <Card className="mt-4">
            <h2 className="text-lg font-bold mb-2">Configuration</h2>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  ssoBaseUrl: ssoConfig.ssoBaseUrl,
                  ssoServerBaseUrl: ssoConfig.ssoServerUrl,
                  clientId: ssoConfig.clientId,
                  redirectUri: ssoConfig.redirectUri,
                  scopes: ssoConfig.scopes,
                },
                null,
                2,
              )}
            </pre>
          </Card>
        </div>
      </main>
    </>
  );
}
