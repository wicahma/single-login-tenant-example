"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { loginWithMicrosoftToken } from "@/lib/client-api";
import { useAuth } from "@/contexts/AuthContext";
import { loginMethods } from "@/config";

export default function MicrosoftManualTestPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [idToken, setIdToken] = useState("");
  const [provider, setProvider] = useState("Microsoft");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!idToken.trim()) {
      setError("Please paste a Microsoft ID token.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setRawResponse(null);

    try {
      console.log("[ManualTest] Sending Microsoft ID token...");
      const result = await loginWithMicrosoftToken(idToken.trim(), provider);

      setRawResponse(JSON.stringify(result, null, 2));

      if (!result.status || !result.data) {
        throw new Error(result.error || "Microsoft login failed");
      }

      const {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType,
        microsoftAccessToken,
        microsoftExpiresIn,
        ...userInfo
      } = result.data;

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

      console.log("[ManualTest] Login successful, redirecting...");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("[ManualTest] Login failed:", err);
      setError(err.message || "An unexpected error occurred");
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
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">
                Microsoft Token Manual Test
              </h1>
              <p className="text-gray-600 text-sm">
                Paste a Microsoft ID token to test the backend endpoint
                directly, bypassing the MSAL.js popup flow. Useful for backend
                testing without needing a full interactive sign-in.
              </p>
            </div>

            {/* Provider */}
            <div className="mb-4">
              <label
                htmlFor="provider"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Provider
              </label>
              <input
                id="provider"
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ID Token */}
            <div className="mb-4">
              <label
                htmlFor="idToken"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Microsoft ID Token
              </label>
              <textarea
                id="idToken"
                rows={8}
                value={idToken}
                onChange={(e) => setIdToken(e.target.value)}
                placeholder="Paste the Microsoft ID token here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            {/* Raw Response */}
            {rawResponse && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raw Response
                </label>
                <pre className="p-3 bg-gray-100 border border-gray-300 rounded-md text-xs overflow-auto max-h-64">
                  {rawResponse}
                </pre>
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Signing in...
                </>
              ) : (
                "Sign in with Token"
              )}
            </Button>
          </Card>

          {/* Usage hints */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <strong>Tip:</strong> You can get a Microsoft ID token by opening
            your browser&apos;s DevTools on the Microsoft login page, or by
            using tools like{" "}
            <code className="bg-blue-100 px-1 rounded">msal.js</code> in the
            console. The token is a JWT — you can decode it at{" "}
            <a
              href="https://jwt.ms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              jwt.ms
            </a>{" "}
            to inspect its claims.
          </div>
        </div>
      </main>
    </>
  );
}
