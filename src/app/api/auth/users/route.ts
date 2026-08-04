import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function GET(request: NextRequest) {
  try {
    const url = `${manualAuthConfig.ssoServerUrl}/public/users?search=19321`;

    // Sign the request
    const { timestamp, signature, nonce } = await signManualRequest(
      "GET",
      url,
      {},
      {
        privateKeyPem: manualAuthConfig.privateKeyPem,
        keyId: manualAuthConfig.keyId,
      },
    );

    const headers: Record<string, string> = {
      "X-App-Identifier": manualAuthConfig.appIdentifier,
      APIKey: manualAuthConfig.apiKey,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      "X-Key-Id": manualAuthConfig.keyId,
      "X-Nonce": nonce,
    };

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/users?search=19321`,
      {
        method: "GET",
        headers,
      },
    );

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "update_failed", message: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Update profile error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
