import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

export async function PUT(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "invalid_token",
          message: "Missing or invalid authorization header",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const url = `${manualAuthConfig.ssoServerUrl}/public/me`;

    // Sign the request
    const { timestamp, signature, nonce } = await signManualRequest(
      "PUT",
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

    const response = await fetch(`${manualAuthConfig.ssoServerUrl}/public/me`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "update_failed", message: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Update profile error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
