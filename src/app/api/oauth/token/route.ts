import { NextRequest, NextResponse } from "next/server";
import { ssoConfig } from "@/config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, redirectUri, codeVerifier, grantType, refreshToken, scope } =
      body;

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

    const params = new Map<string, any>();
    const gt =
      grantType || (refreshToken ? "refresh_token" : "authorization_code");
    params.set("grantType", gt);
    params.set("clientId", clientId);

    if (gt === "authorization_code") {
      if (!code || !redirectUri || !codeVerifier) {
        console.log("Missing required params for authorization_code grant");
        return NextResponse.json(
          {
            error: "invalid_request",
            errorDescription: "Missing required params",
          },
          { status: 400 },
        );
      }
      params.set("code", code);
      params.set("redirectUri", redirectUri);
      params.set("codeVerifier", codeVerifier);
    } else if (gt === "refresh_token") {
      if (!refreshToken) {
        console.log("Missing refresh_token for refresh_token grant");
        return NextResponse.json(
          {
            error: "invalid_request",
            errorDescription: "Missing refresh_token",
          },
          { status: 400 },
        );
      }
      console.log(typeof refreshToken);
      params.set("refreshToken", refreshToken);
      if (scope) {
        params.set("scope", scope);
      }
    }

    if (clientSecret) {
      params.set("clientSecret", clientSecret);
    }

    console.log("Token request params:", Object.fromEntries(params));

    const response = await fetch(
      `${ssoConfig.ssoServerUrl}/public/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Strict-Transport-Security":
            "max-age=31536000; includeSubDomains; preload",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "X-XSS-Protection": "1; mode=block",
        },
        body: JSON.stringify(Object.fromEntries(params)),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log("ssoConfig ssoServerUrl :", ssoConfig.ssoServerUrl);
      console.log("Token endpoint error:", errorText);
      return NextResponse.json(
        { error: "token_error", errorDescription: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log("Token response data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.log("Server error in token route:", (error as Error).message);
    return NextResponse.json(
      { error: "server_error", errorDescription: (error as Error).message },
      { status: 500 },
    );
  }
}
