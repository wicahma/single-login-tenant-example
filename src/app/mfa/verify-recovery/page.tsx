"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import {
  exchangePreTokenForSession,
  verifyRecoveryMFA,
} from "@/lib/client-api";
import { tryParseJSON } from "@/lib/json";
import { clearMfaSession, readMfaSession } from "../../../lib/mfa-flow";
import { loginMethods } from "@/config";

export default function MfaVerifyRecoveryPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [userIdentifier, setUserIdentifier] = useState("");
  const [preToken, setPreToken] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
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

  const handleVerifyRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const verifyResult = await verifyRecoveryMFA(
        userIdentifier,
        recoveryCode,
      );
      if (!verifyResult.status) {
        throw new Error(verifyResult.error || "Failed to verify recovery code");
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
            <h1 className="text-3xl font-bold mb-3">Use a recovery code</h1>
            <p className="text-gray-600 mb-6">
              Enter one of the recovery codes you saved during MFA enrollment.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
                <pre>{tryParseJSON(error)}</pre>
              </div>
            )}

            <form onSubmit={handleVerifyRecovery} className="space-y-4">
              <Input label="User Identifier" value={userIdentifier} disabled />
              <Input
                label="Recovery Code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                placeholder="Enter recovery code"
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
                  "Verify recovery code"
                )}
              </Button>
            </form>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/mfa/verify")}
              >
                Back to authenticator code
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
