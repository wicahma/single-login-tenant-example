"use server";
import { manualAuthConfig } from "@/config";
import { signManualRequest } from "@/lib/crypto";

export interface ApiClientOptions {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, any>;
  extraHeaders?: Record<string, string>;
  requiresAuth?: boolean;
}

export async function makeApiRequest<T = any>(
  options: ApiClientOptions,
): Promise<T> {
  const {
    endpoint,
    method = "GET",
    body,
    extraHeaders = {},
    requiresAuth = false,
  } = options;

  const url = `${manualAuthConfig.ssoBaseUrl}${endpoint}`;

  const { timestamp, signature, nonce } = await signManualRequest(
    method,
    url,
    body || null,
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
    ...extraHeaders,
  };

  const response = await fetch(
    `/api/auth${endpoint.replace("/api/public", "")}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || `Request failed: ${response.statusText}`,
    );
  }

  return await response.json();
}

export async function login(
  identifier: string,
  password: string,
  usernameSource: string = "npk",
  passwordSource: string = "",
) {
  return makeApiRequest({
    endpoint: "/api/public/login",
    method: "POST",
    body: { identifier, password },
    extraHeaders: {
      "x-username-source": usernameSource,
      "x-pass-source": passwordSource,
    },
  });
}

export async function refreshToken(refreshToken: string) {
  return makeApiRequest({
    endpoint: "/api/public/me/refresh-token",
    method: "POST",
    body: { refreshToken },
  });
}

export async function logout(accessToken: string) {
  return makeApiRequest({
    endpoint: "/api/public/logout",
    method: "POST",
    body: {},
    extraHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getUserDetails(accessToken: string) {
  return makeApiRequest({
    endpoint: "/api/public/me",
    method: "GET",
    extraHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
