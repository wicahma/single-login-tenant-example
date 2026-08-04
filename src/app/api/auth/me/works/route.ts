import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function GET(request: NextRequest) {
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

    const url = `${manualAuthConfig.ssoServerUrl}/public/me/works`;

    const { timestamp, signature, nonce } = await signManualRequest(
      "GET",
      url,
      null,
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
      Authorization: authorization,
      "x-app-id": manualAuthConfig.appIdentifier,
      "x-app-secret": manualAuthConfig.apiKey,
    };

    if (manualAuthConfig.usernameSource) {
      headers["x-username-source"] = manualAuthConfig.usernameSource;
    }

    console.log("Request Headers:", headers);

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "fetch_failed", message: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Get user works error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
