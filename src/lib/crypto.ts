"use server";
import { getTimestamp, generateNonce } from "./pkce";

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  console.log("Importing private key", pemKey);
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/[\r\n]/g, "");

  console.log("[CryptoUtils] Importing private key from PEM", pemContents);
  const binaryDer = atob(pemContents);
  const bytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    bytes[i] = binaryDer.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name: "RSA-PSS",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

function canonicalizeJson(body: Record<string, any> | null): string {
  if (!body || Object.keys(body).length === 0) {
    return "{}";
  }

  const sortObject = (obj: Record<string, any>) => {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      return obj;
    }

    return Object.keys(obj)
      .sort()
      .reduce((result: Record<string, any>, key: string) => {
        result[key] = sortObject(obj[key]);
        return result;
      }, {});
  };

  return JSON.stringify(sortObject(body));
}

async function computeBodyHash(
  body: Record<string, any> | null,
): Promise<string> {
  const canonical = canonicalizeJson(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function buildCanonicalString(params: {
  timestamp: string;
  method: string;
  url: string;
  bodyHash: string;
  keyId: string;
  nonce: string;
}): Promise<string> {
  const { timestamp, method, url, bodyHash, keyId, nonce } = params;
  const urlObj = new URL(url);
  const pathAndQuery = urlObj.pathname.slice(4) + urlObj.search;

  return [
    timestamp,
    method.toUpperCase(),
    urlObj.protocol.replace(":", "") + "://" + urlObj.hostname,
    pathAndQuery,
    keyId,
    bodyHash,
    nonce,
  ].join("\n");
}

async function signRequest(
  privateKey: CryptoKey,
  canonicalString: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);

  const signature = await crypto.subtle.sign(
    {
      name: "RSA-PSS",
      saltLength: 32,
    },
    privateKey,
    data,
  );

  return btoa(String.fromCodePoint(...new Uint8Array(signature)));
}

export async function signManualRequest(
  method: string,
  url: string,
  body: Record<string, any> | null,
  config: {
    privateKeyPem: string;
    keyId: string;
  },
): Promise<{
  timestamp: string;
  signature: string;
  nonce: string;
  bodyHash: string;
}> {
  const privateKey = await importPrivateKey(config.privateKeyPem);
  const timestamp = getTimestamp();
  const nonce = generateNonce();
  const bodyHash = await computeBodyHash(body);

  const canonicalString = await buildCanonicalString({
    timestamp,
    method,
    url,
    bodyHash,
    keyId: config.keyId,
    nonce,
  });

  const signature = await signRequest(privateKey, canonicalString);

  return { timestamp, signature, nonce, bodyHash };
}

export { computeBodyHash, buildCanonicalString };
