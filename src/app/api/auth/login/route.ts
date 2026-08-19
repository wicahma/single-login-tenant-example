import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${manualAuthConfig.ssoServerUrl}/public/login`;

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
      "Accept-Language": "id",
      // "X-Risk-Level": "VERY_HIGH",
      // "X-Force-Mfa": "true",
    };

    const usernameSource = request.headers.get("x-username-source");
    if (usernameSource) {
      headers["x-username-source"] = usernameSource;
    }

    const passSource = request.headers.get("x-pass-source");
    if (passSource) {
      headers["x-pass-source"] = passSource;
    }

    const responseType = request.headers.get("x-response-type");
    if (responseType) {
      headers["x-response-type"] = responseType;
    }

    const visitorId = request.headers.get("x-visitor-id");
    if (visitorId) {
      headers["x-visitor-id"] = visitorId;
    }

    const isPrivate = request.headers.get("x-is-private");
    if (isPrivate) {
      headers["x-is-private"] = isPrivate;
    }

    console.log("Request Body:", body);
    console.log("Request Headers:", headers);

    console.log(
      "Sending login request to SSO server at:",
      manualAuthConfig.ssoServerUrl,
    );

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/login`,
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
      console.log("Login failed with response:", parsed.text);
      return NextResponse.json(
        { error: "login_failed", message: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
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
