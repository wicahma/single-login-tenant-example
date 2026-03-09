import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

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

    const workId = request.nextUrl.searchParams.get("workId");
    const uamAolId = request.nextUrl.searchParams.get("uamAolId");
    let backendUrl = `${manualAuthConfig.ssoServerUrl}/public/me/uam`;

    if (workId != null && uamAolId === null) {
      backendUrl += `?workId=${workId}`;
    }
    if (uamAolId != null && workId === null) {
      backendUrl += `?uamAolId=${uamAolId}`;
    }
    if (workId != null && uamAolId != null) {
      backendUrl += `?workId=${workId}&uamAolId=${uamAolId}`;
    }

    const { timestamp, signature, nonce } = await signManualRequest(
      "GET",
      backendUrl,
      null,
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
      "x-app-id": manualAuthConfig.appIdentifier,
      "x-app-secret": manualAuthConfig.apiKey,
    };

    if (manualAuthConfig.usernameSource) {
      headers["x-username-source"] = manualAuthConfig.usernameSource;
    }

    const response = await fetch(backendUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "fetch_failed", message: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Get user UAM error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
