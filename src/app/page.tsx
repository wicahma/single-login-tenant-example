"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { isAuthenticated, user, logout, loginMethod } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleGoToDashboard = () => {
    if (loginMethod === "oauth") {
      router.push("/oauth/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">
            SSO Tenant Example - Next.js
          </h1>

          {isAuthenticated && user ? (
            <Card className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Welcome, {user.name}!</h2>
              <p className="text-gray-600 mb-2">
                You are successfully logged in via{" "}
                <span className="font-semibold">
                  {loginMethod === "oauth"
                    ? "OAuth 2.0"
                    : loginMethod === "manual"
                      ? "Manual Login"
                      : loginMethod === "microsoft"
                        ? "Microsoft Login"
                        : "Direct Login"}
                </span>
                .
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {loginMethod === "oauth"
                  ? "Your session is managed by the OAuth provider."
                  : loginMethod === "microsoft"
                    ? "Your session uses Microsoft Entra ID authentication with auto token refresh."
                    : "Your session uses request signing with auto token refresh."}
              </p>
              <Button onClick={handleGoToDashboard}>Go to Dashboard</Button>
            </Card>
          ) : (
            <>
              <Card className="mb-6">
                <h2 className="text-2xl font-bold mb-4">
                  Authentication Methods
                </h2>
                <p className="text-gray-600 mb-6">
                  This example demonstrates two authentication methods for SSO
                  integration:
                </p>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-2">
                      OAuth 2.0 / OIDC{" "}
                      <span className="text-red-500">(Deprecated)</span>
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Authorization Code Flow with PKCE. Redirects to SSO login
                      page.
                    </p>
                    <Link href="/oauth/login">
                      <Button className="w-full">OAuth Login</Button>
                    </Link>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-2">Manual Login</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Direct username/password login with RSA-PSS request
                      signing.
                    </p>
                    <Link href="/manual/login">
                      <Button variant="secondary" className="w-full">
                        Manual Login
                      </Button>
                    </Link>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-2">
                      <span className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 21 21"
                          width="16"
                          height="16"
                          className="inline-block"
                        >
                          <rect
                            x="1"
                            y="1"
                            width="9"
                            height="9"
                            fill="#f25022"
                          />
                          <rect
                            x="11"
                            y="1"
                            width="9"
                            height="9"
                            fill="#7fba00"
                          />
                          <rect
                            x="1"
                            y="11"
                            width="9"
                            height="9"
                            fill="#00a4ef"
                          />
                          <rect
                            x="11"
                            y="11"
                            width="9"
                            height="9"
                            fill="#ffb900"
                          />
                        </svg>
                        Microsoft Login
                      </span>
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Passwordless authentication via Microsoft Entra ID. Uses
                      MSAL.js to acquire an ID token.
                    </p>
                    <Link href="/microsoft/login">
                      <Button variant="secondary" className="w-full">
                        Sign in with Microsoft
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-bold mb-4">Getting Started</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Configure your environment variables in .env</li>
                  <li>Choose an authentication method above</li>
                  <li>Complete the login flow</li>
                  <li>Access the dashboard</li>
                </ol>
              </Card>
            </>
          )}
        </div>
      </main>
    </>
  );
}
