"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { exchangePreTokenForSession, verifyMFA } from "@/lib/client-api";
import { tryParseJSON } from "@/lib/json";
import {
  clearMfaSession,
  getOrCreateMfaFingerprint,
  readMfaSession,
} from "../../../lib/mfa-flow";
import { loginMethods } from "@/config";

export default function MfaVerifyPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [userIdentifier, setUserIdentifier] = useState("");
  const [preToken, setPreToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mfaSession = readMfaSession();
    if (!mfaSession) {
      router.replace("/manual/login");
      return;
    }

    setUserIdentifier(mfaSession.identifier);
    setPreToken(mfaSession.preToken);
  }, [router]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const verifyResult = await verifyMFA(
        userIdentifier,
        token,
        preToken,
        getOrCreateMfaFingerprint(),
        navigator.userAgent,
      );

      if (!verifyResult.status) {
        throw new Error(verifyResult.error || "Failed to verify MFA code");
      }

      const sessionResult = await exchangePreTokenForSession(preToken);
      if (!sessionResult.status || !sessionResult.data) {
        throw new Error(sessionResult.error || "Failed to finish sign-in");
      }

      const { accessToken, refreshToken, expiresIn, tokenType, ...userInfo } =
        sessionResult.data;

      login(
        { accessToken, refreshToken, expiresIn, tokenType },
        userInfo,
        loginMethods.manual,
      );
      clearMfaSession();
      router.push("/dashboard");
    } catch (verifyError) {
      setError((verifyError as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={false} onLogout={() => {}} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-3xl font-bold mb-3">
              Verify your authenticator code
            </h1>
            <p className="text-gray-600 mb-6">
              Enter the current code from your authenticator app to finish
              signing in.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
                <pre>{tryParseJSON(error)}</pre>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <Input label="User Identifier" value={userIdentifier} disabled />
              <Input
                label="Authenticator Code"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                maxLength={6}
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                disabled={isLoading}
                required
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Verifying...
                  </span>
                ) : (
                  "Verify and continue"
                )}
              </Button>
            </form>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/mfa/verify-recovery")}
              >
                Use a recovery code instead
              </Button>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => {
                  clearMfaSession();
                  router.push("/manual/login");
                }}
              >
                Back to login
              </button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
