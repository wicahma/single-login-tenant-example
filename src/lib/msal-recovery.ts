"use client";

/**
 * MFA Recovery Service
 *
 * When the backend's silent Microsoft token refresh returns
 *   401 { error: "mfa_required" }
 * this module launches an MSAL interactive popup so the user can complete MFA,
 * then exchanges the resulting authorization code with our backend recovery
 * endpoint to obtain a fresh Microsoft access token.
 */

import {
  PublicClientApplication,
  type Configuration,
  type PopupRequest,
  type AuthenticationResult,
} from "@azure/msal-browser";
import { msalConfig as msalConfigValues, storageKeys } from "@/config";
import type {
  MicrosoftTokenData,
  RBaseResponse,
  RecoverMicrosoftSessionRequest,
} from "@/lib/types/auth";

// ---------------------------------------------------------------------------
// MSAL instance — lazy-initialized once per browser session
// ---------------------------------------------------------------------------

let _msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (_msalInstance) return _msalInstance;

  const config: Configuration = {
    auth: {
      clientId: msalConfigValues.clientId,
      authority: `https://login.microsoftonline.com/${msalConfigValues.tenantId}`,
      redirectUri: msalConfigValues.redirectUri,
    },
    cache: {
      cacheLocation: "localStorage",
    },
  };

  _msalInstance = new PublicClientApplication(config);
  return _msalInstance;
}

// --------------------------------------------------------------------------
// Public popup request — scopes must match what the backend requests on Graph
// --------------------------------------------------------------------------

const mfaRecoveryRequest: PopupRequest = {
  scopes: ["openid", "profile", "offline_access", "User.Read"],
  redirectUri: msalConfigValues.redirectUri,
  /**
   * "login" forces a fresh credential prompt even when an SSO session already
   * exists, ensuring the user re-satisfies the MFA requirement.
   */
  prompt: "login",
};

// ---------------------------------------------------------------------------
// Helper: narrow a 401 response body to the mfa_required shape
// ---------------------------------------------------------------------------

export function isMfaRequiredError(
  data: unknown,
): data is { error: "mfa_required"; message: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).error === "mfa_required"
  );
}

// ---------------------------------------------------------------------------
// Core recovery function
// ---------------------------------------------------------------------------

/**
 * 1. Opens an MSAL interactive popup so the user completes MFA.
 * 2. Extracts the `code` (authorization_code) from the MSAL result.
 * 3. POSTs to `/api/auth/recover-microsoft-session` (our Next.js BFF proxy).
 * 4. Stores the new token in localStorage and returns it.
 *
 * Throws on any failure — callers should handle by redirecting to full re-login.
 */
export async function triggerMfaRecovery(
  iamAccessToken: string,
): Promise<string> {
  const msalInstance = getMsalInstance();
  await msalInstance.initialize();

  let popupResult: AuthenticationResult;
  try {
    popupResult = await msalInstance.loginPopup(mfaRecoveryRequest);
  } catch (popupError) {
    throw new Error(
      `MSAL popup failed or was cancelled: ${(popupError as Error).message}`,
    );
  }

  const authorizationCode = (popupResult as any).code as string | undefined;
  if (!authorizationCode) {
    throw new Error(
      "MSAL popup did not return an authorization_code. " +
        "Ensure the MSAL PublicClientApplication is configured with responseType=code.",
    );
  }

  const requestBody: RecoverMicrosoftSessionRequest = {
    authorizationCode,
    redirectUri: msalConfigValues.redirectUri,
  };

  const response = await fetch("/api/auth/recover-microsoft-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${iamAccessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseData: RBaseResponse<MicrosoftTokenData> = await response.json();

  if (!response.ok || !responseData.data?.accessToken) {
    throw new Error(
      responseData.message ||
        "MFA recovery endpoint did not return an access token.",
    );
  }

  storeMicrosoftAccessToken(responseData.data);

  return responseData.data.accessToken;
}

// ---------------------------------------------------------------------------
// Token persistence
// ---------------------------------------------------------------------------

function storeMicrosoftAccessToken(data: MicrosoftTokenData): void {
  const expiresAt = Date.now() + data.expiresIn * 1000;
  localStorage.setItem(storageKeys.microsoftAccessToken, data.accessToken);
  localStorage.setItem(storageKeys.microsoftExpiresAt, String(expiresAt));
  localStorage.setItem(storageKeys.msSessionAvailable, "true");
}
