import { NextRequest, NextResponse } from "next/server";
import { ssoConfig } from "@/config";
import { parseBackendResponse, wafErrorResponse } from "@/lib/backend-response";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "invalid_token",
          errorDescription: "Missing or invalid authorization header",
        },
        { status: 401 },
      );
    }

    const headers = {
      Authorization: authorization,
      Tenant: process.env.APP_IDENTIFIER || "",
      "Strict-Transport-Security":
        "max-age=31536000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
    };

    console.log("Fetching userinfo with headers:", headers);

    const response = await fetch(
      `${ssoConfig.ssoServerUrl}/public/oauth/userinfo`,
      {
        method: "POST",
        headers,
      },
    );

    const parsed = await parseBackendResponse(response);

    if (parsed.isWaf) {
      return wafErrorResponse(parsed);
    }

    if (!parsed.ok) {
      console.log("Userinfo endpoint error:", parsed.text);
      return NextResponse.json(
        { error: "userinfo_error", errorDescription: parsed.text },
        { status: parsed.status },
      );
    }

    const data = parsed.data;
    return NextResponse.json(data);
  } catch (error) {
    console.log("Server error in userinfo route:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", errorDescription: (error as Error).message },
      { status: 500 },
    );
  }
}
