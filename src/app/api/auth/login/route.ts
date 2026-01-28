import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${manualAuthConfig.ssoBaseUrl}/api/public/login`;

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
      "x-username-source": "npk",
    };

    console.log("Request Body:", body);
    console.log("Request Headers:", headers);

    const usernameSource = request.headers.get("x-username-source");
    if (usernameSource) {
      headers["x-username-source"] = usernameSource;
    }

    const passSource = request.headers.get("x-pass-source");
    if (passSource) {
      headers["x-pass-source"] = passSource;
    }

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/login`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "login_failed", message: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log("Login successful:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.log("Login error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
