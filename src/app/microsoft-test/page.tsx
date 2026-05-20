"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { storageKeys } from "@/config";
import { Card, Button, LoadingSpinner } from "@/components/atoms";
import { ReConsentBanner } from "@/components/molecules";
import { Header } from "@/components/organisms";
import { callGraphAPI, isMicrosoftSessionAvailable } from "@/lib/client-api";

// ---------------------------------------------------------------------------
// Excel file to embed — change only this constant to swap the file
// ---------------------------------------------------------------------------
// The embed URL is derived from the original SharePoint link by switching
// action=default → action=embedview, which enables iframe embedding.
const EXCEL_EMBED_URL =
  "https://accfinance-my.sharepoint.com/:x:/r/personal/oky_arianto_acc_co_id/_layouts/15/doc2.aspx" +
  "?sourcedoc=%7BC6026C29-B43C-4305-984D-A50DB661DC92%7D" +
  "&file=Activity%20IAM.xlsx" +
  "&action=embedview" +
  "&wdAllowInteractivity=True" +
  "&wdHideGridlines=False" +
  "&wdHideHeaders=False" +
  "&wdDownloadButton=True" +
  "&wdInConfigurator=True" +
  "&wdInConfigurator=True";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GraphMeResult {
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
  id?: string;
}

type TokenTestState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; data: GraphMeResult }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MicrosoftTestPage() {
  const {
    isAuthenticated,
    logout,
    accessToken,
    isMicrosoftSessionAvailable: msAvailable,
    showMSBanner,
  } = useAuth();
  const router = useRouter();

  const [tokenTestState, setTokenTestState] = useState<TokenTestState>({
    phase: "idle",
  });
  const [msTokenInfo, setMsTokenInfo] = useState<{
    token: string;
    expiresAt: string;
    available: boolean;
  } | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Hydrate MS token info from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(storageKeys.microsoftAccessToken) ?? "";
    const expiresAt =
      localStorage.getItem(storageKeys.microsoftExpiresAt) ?? "0";
    const available = isMicrosoftSessionAvailable();

    const expiresMs = parseInt(expiresAt, 10);
    const expiresDate =
      expiresMs > 0 ? new Date(expiresMs).toLocaleString() : "—";

    setMsTokenInfo({
      token,
      expiresAt: expiresDate,
      available,
    });
  }, [msAvailable]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  // -------------------------------------------------------------------------
  // Graph API test — calls /me via callGraphAPI wrapper
  // -------------------------------------------------------------------------
  const handleTestGraphAPI = useCallback(async () => {
    if (!accessToken) return;

    setTokenTestState({ phase: "loading" });
    try {
      const me = await callGraphAPI<GraphMeResult>("/me", accessToken);
      setTokenTestState({ phase: "success", data: me });
    } catch (err: any) {
      setTokenTestState({
        phase: "error",
        message: err.message ?? "Unknown error",
      });
    }
  }, [accessToken]);

  if (!isAuthenticated) return null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <ReConsentBanner />

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Microsoft Integration Test</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verify the Microsoft token lifecycle and preview the embedded Excel
            file below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* ── MS Session Status ── */}
          <Card>
            <h2 className="text-base font-semibold mb-3">Microsoft Session</h2>

            <div className="space-y-2 text-sm">
              <StatusRow
                label="Session available"
                value={(msTokenInfo?.available ?? false) ? "Yes ✅" : "No ❌"}
                highlight={msTokenInfo?.available}
              />
              <StatusRow
                label="Token expires at"
                value={msTokenInfo?.expiresAt ?? "—"}
              />
              <StatusRow
                label="Raw token (first 40 chars)"
                value={
                  msTokenInfo?.token
                    ? msTokenInfo.token.slice(0, 40) + "…"
                    : "(empty)"
                }
                mono
              />
            </div>

            {!msTokenInfo?.available && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No Microsoft session. Log out and log back in with an account
                that has Microsoft SSO configured.
              </p>
            )}
          </Card>

          {/* ── Graph API Test ── */}
          <Card>
            <h2 className="text-base font-semibold mb-3">Graph API — /me</h2>
            <p className="text-xs text-gray-500 mb-4">
              Calls <code>https://graph.microsoft.com/v1.0/me</code> using the
              stored Microsoft access token. One silent refresh is attempted
              automatically on 401.
            </p>

            <Button
              onClick={handleTestGraphAPI}
              disabled={tokenTestState.phase === "loading"}
              variant="primary"
            >
              {tokenTestState.phase === "loading" ? "Testing…" : "Run test"}
            </Button>

            {tokenTestState.phase === "success" && (
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium text-green-700">✅ Token is valid</p>
                <StatusRow
                  label="Display name"
                  value={tokenTestState.data.displayName ?? "—"}
                />
                <StatusRow
                  label="UPN"
                  value={tokenTestState.data.userPrincipalName ?? "—"}
                />
                <StatusRow
                  label="Mail"
                  value={tokenTestState.data.mail ?? "—"}
                />
                <StatusRow
                  label="Object ID"
                  value={tokenTestState.data.id ?? "—"}
                  mono
                />
              </div>
            )}

            {tokenTestState.phase === "error" && (
              <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <p className="font-medium">❌ Graph call failed</p>
                <p className="mt-0.5 font-mono text-xs break-all">
                  {tokenTestState.message}
                </p>
              </div>
            )}
          </Card>

          {/* ── Quick actions ── */}
          <Card>
            <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={() => router.push("/dashboard")}
              >
                ← Back to Dashboard
              </Button>
              <Button variant="danger" onClick={handleLogout}>
                Log Out
              </Button>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Logging out will cancel the Microsoft token refresh timer and
              clear all session storage.
            </p>
          </Card>
        </div>

        {/* ── Excel Embed ── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">
                Excel Preview — Activity IAM.xlsx
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Embedded via SharePoint Office Online (
                <code>action=embedview</code>). Authentication uses your
                existing Microsoft browser session.
              </p>
            </div>
            {!iframeLoaded && !iframeError && <LoadingSpinner />}
            {iframeLoaded && (
              <span className="text-xs text-green-600 font-medium">
                ✅ Loaded
              </span>
            )}
            {iframeError && (
              <span className="text-xs text-red-600 font-medium">
                ❌ Failed to load
              </span>
            )}
          </div>

          {msTokenInfo?.available === false && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠ No Microsoft session detected. The embed may prompt you to sign
              in to Microsoft again — that is expected when{" "}
              <code>microsoft_access_token</code> is absent.
            </div>
          )}

          <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* Aspect-ratio spacer: 16:9 for spreadsheet */}
            <div style={{ paddingTop: "56.25%" }} />

            <iframe
              src={EXCEL_EMBED_URL}
              title="Activity IAM.xlsx — SharePoint Office Online embed"
              allowFullScreen
              allow="clipboard-read; clipboard-write"
              className="absolute inset-0 h-full w-full border-0"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeError(false);
              }}
              onError={() => {
                setIframeError(true);
                setIframeLoaded(false);
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            />
          </div>

          <p className="mt-2 text-xs text-gray-400">
            The iframe uses <strong>SharePoint Office Online</strong> — all
            native Excel features (formulas, filters, freeze panes, etc.) are
            rendered server-side by Microsoft. No Excel files are downloaded to
            our server.
          </p>
        </Card>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------
function StatusRow({
  label,
  value,
  highlight,
  mono = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={[
          "text-right break-all",
          mono ? "font-mono text-xs" : "",
          highlight === true
            ? "text-green-700 font-medium"
            : highlight === false
              ? "text-red-600 font-medium"
              : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
