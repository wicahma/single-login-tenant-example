import { NextRequest, NextResponse } from "next/server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

export async function POST(request: NextRequest) {
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
    const { currentPassword, newPassword, confirmNewPassword } = body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "Missing required fields",
        },
        { status: 400 },
      );
    }

    const url = `${manualAuthConfig.ssoServerUrl}/public/me/change-password`;

    const requestBody = {
      currentPassword,
      newPassword,
      confirmNewPassword,
    };

    // Sign the request
    const { timestamp, signature, nonce } = await signManualRequest(
      "POST",
      url,
      requestBody,
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

    // Add optional password type header if provided
    const passwordType = request.headers.get("x-password-type");
    if (passwordType) {
      headers["x-password-type"] = passwordType;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || "change_password_failed",
          message: errorData.message || "Failed to change password",
        },
        { status: response.status },
      );
    }

    console.log("Request Body:", body);
    console.log("Request Headers:", headers);

    const data = await response.json();
    return NextResponse.json({
      status: true,
      message: data.message || "Password changed successfully",
      data: data.data,
    });
  } catch (error) {
    console.error("Change password error:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
