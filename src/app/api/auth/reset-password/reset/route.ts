import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${manualAuthConfig.ssoServerUrl}/public/reset-password/reset`;

    const resetProvider = request.headers.get("x-reset-provider");

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
    };

    if (resetProvider) {
      headers["x-reset-provider"] = resetProvider;
    }

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/reset-password/reset`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "password_reset_failed", message: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Password reset error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
