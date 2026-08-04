import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

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

    const url = `${manualAuthConfig.ssoServerUrl}/public/me/refresh-microsoft-token`;

    const body = {};

    const { timestamp, signature, nonce } = await signManualRequest(
      "POST",
      url,
      body,
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
      body: JSON.stringify(body),
    });

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    const data = parsed.data as Record<string, any> | null;

    if (!parsed.ok) {
      return NextResponse.json(
        {
          status: false,
          message:
            data?.message ||
            `Microsoft token refresh failed: ${parsed.statusText}`,
        },
        { status: parsed.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[refresh-microsoft-token] Unexpected error:", error);
    return NextResponse.json(
      {
        status: false,
        message: (error as Error).message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
