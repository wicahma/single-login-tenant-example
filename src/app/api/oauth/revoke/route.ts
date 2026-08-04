import { NextRequest, NextResponse } from "next/server";
import { ssoConfig } from "@/config";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, tokenTypeHint } = body;

    if (!token) {
      return NextResponse.json(
        {
          error: "invalid_request",
          errorDescription: "Missing token parameter",
        },
        { status: 400 },
      );
    }

    const clientId = ssoConfig.clientId;
    const clientSecret = ssoConfig.clientSecret;

    if (!clientId) {
      console.log("CLIENT_ID not configured");
      return NextResponse.json(
        {
          error: "invalid_client",
          errorDescription: "CLIENT_ID not configured",
        },
        { status: 400 },
      );
    }

    const params: Record<string, string> = {
      token,
      clientId,
    };

    if (tokenTypeHint) {
      params.tokenTypeHint = tokenTypeHint;
    }

    if (clientSecret) {
      params.clientSecret = clientSecret;
    }

    console.log("Revoke request params:", params);

    const response = await fetch(
      `${ssoConfig.ssoServerUrl}/public/oauth/revoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      },
    );

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      console.log("Revoke endpoint error:", parsed.text);
      return NextResponse.json(
        { error: "revoke_error", errorDescription: parsed.text },
        { status: parsed.status },
      );
    }

    // Revoke endpoint typically returns 200 with no content
    return NextResponse.json({
      status: true,
      message: "Token revoked successfully",
    });
  } catch (error) {
    console.log("Server error in revoke route:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", errorDescription: (error as Error).message },
      { status: 500 },
    );
  }
}
