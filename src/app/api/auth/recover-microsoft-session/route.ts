import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

/**
 * POST /api/auth/recover-microsoft-session
 *
 * BFF proxy: forwards the authorization_code and redirectUri from the browser
 * to the backend's /public/me/recover-microsoft-session endpoint.
 * The IAM access token is passed through via the Authorization header.
 *
 * Request body: { authorizationCode: string; redirectUri: string }
 * Response:     RBaseResponse<{ accessToken; expiresIn; tokenType }>
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          status: false,
          message: "Missing or invalid authorization header",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { authorizationCode, redirectUri } = body as {
      authorizationCode?: string;
      redirectUri?: string;
    };

    if (!authorizationCode || !redirectUri) {
      return NextResponse.json(
        {
          status: false,
          message: "authorizationCode and redirectUri are required",
        },
        { status: 400 },
      );
    }

    const url = `${manualAuthConfig.ssoServerUrl}/public/me/recover-microsoft-session`;

    const requestBody = { authorizationCode, redirectUri };

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
      Authorization: authorization,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          status: false,
          message:
            data.message ||
            `Microsoft session recovery failed: ${response.statusText}`,
          errors: data.errors,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[recover-microsoft-session] Unexpected error:", error);
    return NextResponse.json(
      {
        status: false,
        message: (error as Error).message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
