import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${manualAuthConfig.ssoServerUrl}/public/reset-password/sms/validate`;

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

    const response = await fetch(
      `${manualAuthConfig.ssoServerUrl}/public/reset-password/sms/validate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );
    const parsed = await parseBackendResponse(response);

    console.log("OTP validation response data:", JSON.stringify(parsed.data));

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "otp_validation_failed", message: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    return NextResponse.json(data);
  } catch (error) {
    console.error("OTP validation error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
