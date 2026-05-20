"use client";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Shown when the Microsoft refresh token is gone or revoked.
 * Rules:
 *   - [Dismiss] hides the banner but does NOT end the IAM session.
 *   - [Log Out]  calls logout() from AuthContext.
 *   - The banner is suppressed once per session via sessionStorage so it
 *     does not re-appear on every navigation.
 */
export function ReConsentBanner() {
  const { showMSBanner, dismissMSBanner, logout } = useAuth();

  if (!showMSBanner) return null;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 shadow-sm"
    >
      {/* Icon */}
      <span className="mt-0.5 text-lg leading-none" aria-hidden>
        ⚠
      </span>

      {/* Message */}
      <div className="flex-1">
        <p className="font-semibold">Microsoft session has expired</p>
        <p className="mt-0.5 text-yellow-800">
          Excel, Word, and SharePoint features are currently unavailable. Log
          out and log in again to restore Microsoft access.
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={dismissMSBanner}
          className="rounded px-3 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-300 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
