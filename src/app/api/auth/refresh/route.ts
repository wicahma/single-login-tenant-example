import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${manualAuthConfig.ssoServerUrl}/public/me/refresh-token`;

    // Sign the request
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

    console.log("Request Body:", body);
    console.log("Request Headers:", headers);

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/me/refresh-token`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "refresh_failed", message: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Refresh token error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
