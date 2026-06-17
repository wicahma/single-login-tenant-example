"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { enrollMFA } from "@/lib/client-api";
import { tryParseJSON } from "@/lib/json";
import { readMfaSession } from "../../../lib/mfa-flow";
import { IEnrollUserResponse } from "@/lib/types/mfa";
import { ssoConfig } from "@/config";

const setupStorageKey = "mfa_enrollment_setup";

export default function MfaEnrollPage() {
  const router = useRouter();
  const [userIdentifier, setUserIdentifier] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentData, setEnrollmentData] =
    useState<IEnrollUserResponse | null>(null);

  useEffect(() => {
    const mfaSession = readMfaSession();
    if (!mfaSession) {
      router.replace("/manual/login");
      return;
    }

    setUserIdentifier(mfaSession.identifier);
    setUserName(mfaSession.userName || mfaSession.identifier);

    const savedSetup = localStorage.getItem(setupStorageKey);
    if (savedSetup) {
      try {
        setEnrollmentData(JSON.parse(savedSetup) as IEnrollUserResponse);
      } catch {
        localStorage.removeItem(setupStorageKey);
      }
    }
  }, [router]);

  const handleEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await enrollMFA(userIdentifier, userName);

      if (!result.status || !result.data) {
        throw new Error(result.error || "Failed to start MFA enrollment");
      }

      setEnrollmentData(result.data);
      localStorage.setItem(setupStorageKey, JSON.stringify(result.data));
    } catch (enrollError) {
      setError((enrollError as Error).message);
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
            <h1 className="text-3xl font-bold mb-3">
              Set up multi-factor authentication
            </h1>
            <p className="text-gray-600 mb-6">
              Enroll your authenticator app first, then continue to verify the
              setup with a one-time code.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
                <pre>{tryParseJSON(error)}</pre>
              </div>
            )}

            {!enrollmentData ? (
              <form onSubmit={handleEnroll} className="space-y-4">
                <Input
                  label="User Identifier"
                  value={userIdentifier}
                  onChange={(event) => setUserIdentifier(event.target.value)}
                  disabled={isLoading}
                  required
                />
                <Input
                  label="Display Name"
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  disabled={isLoading}
                  required
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="sm" />
                      Starting enrollment...
                    </span>
                  ) : (
                    "Generate MFA setup"
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    1. Scan the QR code
                  </p>
                  <img
                    src={`${ssoConfig.mfaServerUrl}${enrollmentData.qrCodeDataUrl}`}
                    alt="MFA QR code"
                    className="mx-auto w-56 h-56 rounded-lg bg-white p-3 shadow-sm"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    2. Or enter the setup key manually
                  </p>
                  <code className="block break-all rounded bg-gray-100 px-3 py-2 text-sm text-gray-800">
                    {enrollmentData.setupKey}
                  </code>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900 mb-2">
                    3. Save your recovery codes
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {enrollmentData.recoveryCodes.map((code) => (
                      <div
                        key={code}
                        className="rounded border border-amber-200 bg-white px-3 py-2 font-mono text-sm text-gray-800"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => router.push("/mfa/verify-setup")}
                  >
                    Continue to verification
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      localStorage.removeItem(setupStorageKey);
                      setEnrollmentData(null);
                    }}
                  >
                    Generate again
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
