import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

/**
 * POST /api/auth/microsoft-login
 *
 * BFF proxy for Microsoft token login.
 * Accepts a Microsoft ID token from the client, signs the request with RSA-PSS,
 * and forwards it to the backend's /public/login endpoint (same endpoint as
 * the password flow, but with { microsoft_id_token } in the body).
 *
 * Request body: { microsoft_id_token: string; provider?: string }
 * Response:     RBaseResponse<TenantLoginResponse>
 *
 * Unlike the password login route, this route:
 *   - Does NOT require x-username-source or x-pass-source headers
 *   - Does NOT expect AES-encrypted credentials
 *   - Forwards the raw Microsoft ID token to the backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { microsoft_id_token, provider } = body as {
      microsoft_id_token?: string;
      provider?: string;
    };

    if (!microsoft_id_token) {
      return NextResponse.json(
        {
          status: false,
          message: "Request body must contain a 'microsoft_id_token' field",
        },
        { status: 400 },
      );
    }

    const url = `${manualAuthConfig.ssoServerUrl}/public/login`;

    const requestBody = {
      microsoft_id_token,
      provider: provider ?? "Microsoft",
    };

    const { timestamp, signature, nonce } = await signManualRequest(
      "POST",
      url,
      requestBody,
      {
        privateKeyPem: manualAuthConfig.privateKeyPem,
        keyId: manualAuthConfig.keyId,
      },
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-App-Identifier": manualAuthConfig.appIdentifier,
      APIKey: manualAuthConfig.apiKey,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      "X-Key-Id": manualAuthConfig.keyId,
      "X-Nonce": nonce,
    };

    console.log("[microsoft-login] Forwarding Microsoft ID token to backend");
    console.log("[microsoft-login] Provider:", provider ?? "Microsoft");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const parsed = await parseBackendResponse(response);

    // Handle HTML / WAF block pages returned by the upstream server
    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    // Handle error responses from the backend
    if (!parsed.ok) {
      const errorData =
        parsed.data && typeof parsed.data === "object"
          ? (parsed.data as Record<string, any>)
          : {};

      // Pass through backend error messages as-is
      return NextResponse.json(
        {
          status: false,
          message:
            errorData.message ||
            errorData.errorDescription ||
            `Microsoft login failed: ${parsed.statusText}`,
          errors: errorData.errors ?? null,
        },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    console.log("[microsoft-login] Login successful");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[microsoft-login] Unexpected error:", error);
    return NextResponse.json(
      {
        status: false,
        message: (error as Error).message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
