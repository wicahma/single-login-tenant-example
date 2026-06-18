"use client";

import { useEffect, useState } from "react";
import {
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-browser";
import { msalConfig as msalConfigValues } from "@/config";
import { LoadingSpinner } from "@/components/atoms";

/**
 * Microsoft Auth Callback Page
 *
 * This page handles the redirect after Microsoft authentication.
 * Both MSAL popup and redirect flows land here with an authorization code
 * in the URL query string (e.g., ?code=...&state=...).
 *
 * MSAL's handleRedirectPromise() captures the code from the URL and
 * completes the authentication flow.
 *
 * This page MUST be registered as a Single-page Application (SPA) redirect URI
 * in the Azure AD app registration.
 *
 * Popup flow:
 *   MSAL opens a popup window → user signs in → Microsoft redirects the popup
 *   here → MSAL captures the code → popup sends result to parent window via
 *   postMessage → parent window's loginPopup() resolves.
 *
 * Redirect flow:
 *   User is redirected here → MSAL handles the response → user is redirected
 *   to the original page.
 */
export default function MicrosoftCallbackPage() {
  const [status, setStatus] = useState("Processing authentication...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      // If MSAL is not configured, just show a message
      if (!msalConfigValues.clientId || !msalConfigValues.tenantId) {
        setError("Microsoft authentication is not configured.");
        return;
      }

      try {
        const config: Configuration = {
          auth: {
            clientId: msalConfigValues.clientId,
            authority: `https://login.microsoftonline.com/${msalConfigValues.tenantId}`,
            redirectUri: msalConfigValues.redirectUri,
          },
          cache: {
            cacheLocation: "sessionStorage",
          },
        };

        const msalInstance = new PublicClientApplication(config);
        await msalInstance.initialize();

        // Handle the redirect promise — this captures the auth code from the URL
        const response = await msalInstance.handleRedirectPromise();

        if (response) {
          // Successfully authenticated via redirect flow
          setStatus("Authentication successful! You can close this window.");
        } else {
          // No response means this is either:
          //   a) The popup flow — MSAL communicates via postMessage internally
          //   b) A direct navigation to this page without an auth flow
          setStatus(
            "No pending authentication request. If you were trying to sign in, " +
              "please go back and try again.",
          );
        }
      } catch (err) {
        console.error("[MicrosoftCallback] Error handling redirect:", err);
        setError((err as Error).message || "Authentication failed");
      }
    };

    handleRedirect();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          {error ? (
            <>
              <div className="text-red-500 text-5xl mb-4">✕</div>
              <h1 className="text-xl font-bold text-red-700 mb-2">
                Authentication Error
              </h1>
              <p className="text-gray-600 text-sm wrap-break-word">{error}</p>
            </>
          ) : (
            <>
              <LoadingSpinner size="lg" />
              <h1 className="text-xl font-bold mt-4 mb-2">
                Completing Sign In
              </h1>
              <p className="text-gray-600 text-sm">{status}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
