import { NextResponse } from "next/server";

/**
 * Markers used to detect an HTML / WAF (Web Application Firewall) block page
 * returned by the upstream server instead of a JSON payload.
 */
const HTML_START_MARKERS = [
  "<!doctype html",
  "<html",
  "<head",
  "<body",
  "<!html",
];

/**
 * Returns true when the raw body looks like an HTML page (i.e. a WAF /
 * firewall challenge or block page) rather than a JSON payload.
 */
export function isHtmlResponse(raw: string): boolean {
  const trimmed = raw.trimStart().toLowerCase();
  return HTML_START_MARKERS.some((marker) => trimmed.startsWith(marker));
}

export interface ParsedBackendResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  /** True when the upstream returned an HTML / WAF page instead of JSON. */
  isWaf: boolean;
  /** The full raw response body as text. */
  text: string;
  /** Parsed JSON payload when the body was valid JSON, otherwise null. */
  data: T | null;
  /** The raw HTML body when a WAF / block page was detected, otherwise null. */
  html: string | null;
}

/**
 * Reads a fetch `Response` body exactly once, detects whether it is an HTML /
 * WAF block page, and returns a normalized result. Callers should use the
 * returned `data` / `text` instead of reading the body again.
 */
export async function parseBackendResponse<T = any>(
  response: Response,
): Promise<ParsedBackendResponse<T>> {
  const text = await response.text();

  if (isHtmlResponse(text)) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      isWaf: true,
      text,
      data: null,
      html: text,
    };
  }

  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    isWaf: false,
    text,
    data,
    html: null,
  };
}

/**
 * Builds the error response sent to the client when the upstream server
 * responded with an HTML / WAF page instead of JSON. The raw HTML is included
 * as a string in the `data` field of the response body.
 */
export function wafErrorResponse(
  parsed: Pick<ParsedBackendResponse, "status" | "html">,
  message = "Request blocked by WAF (Web Application Firewall)",
): NextResponse {
  // WAF pages normally arrive with a 4xx status (e.g. 403). If the upstream
  // returned the HTML page with a 2xx/3xx status, treat it as a bad gateway so
  // the client reliably handles it as an error.
  const status = parsed.status >= 400 ? parsed.status : 502;

  console.log("WAF block detected, returning error response to client:", {
    status,
    message,
    html: parsed.html,
  });

  return NextResponse.json(
    {
      status: false,
      error: "waf_blocked",
      message: `${message} - ${parsed.html?.split("<br>")[2]}`,
      data: parsed.html,
      wafBlocked: true,
    },
    { status },
  );
}
