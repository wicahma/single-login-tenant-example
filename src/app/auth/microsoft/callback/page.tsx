"use client";

import { useEffect, useState } from "react";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import { LoadingSpinner } from "@/components/atoms";

/**
 * Microsoft Auth Callback Page
 *
 * MSAL v5 popup flow:
 *   1. Parent opens popup → popup navigates to Microsoft login
 *   2. User signs in → Microsoft redirects popup back HERE (?code=...&state=...)
 *   3. This page calls broadcastResponseToMainFrame() which:
 *      a) Parses the auth code + state from the URL
 *      b) Sends them to the parent window via BroadcastChannel
 *      c) Closes the popup
 *   4. Parent's loginPopup() receives the response and resolves
 *
 * IMPORTANT: DO NOT call handleRedirectPromise() here — that is for the
 * REDIRECT flow only (user is redirected in the main window). For popup
 * flow, the response goes through BroadcastChannel.
 *
 * This page MUST be registered as a Single-page Application (SPA) redirect
 * URI in the Azure AD app registration.
 */
export default function MicrosoftCallbackPage() {
  const [status, setStatus] = useState("Processing authentication...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        await broadcastResponseToMainFrame();
        // If we reach here, the response was sent to the parent via
        // BroadcastChannel. The popup can close itself.
        setStatus("Authentication completed. You may close this window.");

        // Auto-close after a brief moment
        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (err) {
        console.error(
          "[MicrosoftCallback] broadcastResponseToMainFrame failed:",
          err,
        );
        const hasAuthCode = new URLSearchParams(window.location.search).has(
          "code",
        );
        if (hasAuthCode) {
          // Auth code exists but broadcast failed — likely a direct navigation
          // or the parent window is no longer listening. Show a message.
          setStatus(
            "Authentication received. If this window doesn't close automatically, " +
              "you may close it manually.",
          );
        } else {
          setError((err as Error).message || "Authentication failed");
        }
      }
    };

    run();
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
