"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { exchangePreTokenForSession, verifySetupMFA } from "@/lib/client-api";
import { tryParseJSON } from "@/lib/json";
import {
  clearMfaSession,
  getOrCreateMfaFingerprint,
  readMfaSession,
} from "../../../lib/mfa-flow";
import { IEnrollUserResponse } from "@/lib/types/mfa";
import { loginMethods, ssoConfig } from "@/config";

const setupStorageKey = "mfa_enrollment_setup";

export default function MfaVerifySetupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [userIdentifier, setUserIdentifier] = useState("");
  const [preToken, setPreToken] = useState("");
  const [token, setToken] = useState("");
  const [setupData, setSetupData] = useState<IEnrollUserResponse | null>(null);
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

    const rawSetupData = localStorage.getItem(setupStorageKey);
    if (rawSetupData) {
      try {
        setSetupData(JSON.parse(rawSetupData) as IEnrollUserResponse);
      } catch {
        localStorage.removeItem(setupStorageKey);
      }
    }
  }, [router]);

  const handleVerifySetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const verifyResult = await verifySetupMFA(
        userIdentifier,
        token,
        getOrCreateMfaFingerprint(),
        preToken,
        navigator.userAgent,
      );

      if (!verifyResult.status) {
        throw new Error(verifyResult.error || "Failed to verify MFA setup");
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

      localStorage.removeItem(setupStorageKey);
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
        <div className="max-w-2xl mx-auto">
          <Card>
            <h1 className="text-3xl font-bold mb-3">Verify your MFA setup</h1>
            <p className="text-gray-600 mb-6">
              Use the authenticator app you just enrolled and enter the first
              verification code.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
                <pre>{tryParseJSON(error)}</pre>
              </div>
            )}

            {setupData && (
              <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[220px_1fr]">
                <img
                  src={`${ssoConfig.mfaServerUrl}${setupData.qrCodeDataUrl}`}
                  alt="MFA QR code"
                  className="mx-auto w-52 h-52 rounded-lg bg-white p-3 shadow-sm"
                />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Setup key
                    </p>
                    <code className="block break-all rounded bg-white px-3 py-2 text-sm text-gray-800">
                      {setupData.setupKey}
                    </code>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Recovery codes
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {setupData.recoveryCodes.map((code) => (
                        <div
                          key={code}
                          className="rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifySetup} className="space-y-4">
              <Input label="User Identifier" value={userIdentifier} disabled />
              <Input
                label="Verification Code"
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
                    Confirming setup...
                  </span>
                ) : (
                  "Verify setup and sign in"
                )}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
