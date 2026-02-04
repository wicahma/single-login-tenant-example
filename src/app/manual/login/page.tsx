"use client";

import { Card } from "@/components/atoms";
import { LoginForm } from "@/components/molecules";
import { Header } from "@/components/organisms";
import { useAuth } from "@/contexts/AuthContext";
import { loginUser } from "@/lib/client-api";
import { loginMethods } from "@/config";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EPasswordSource,
  EUsernameSource,
  TResponseType,
} from "@/lib/types/auth";

export default function ManualLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleSubmit = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const usernameSource: EUsernameSource = "Npk";
      const passwordSource: EPasswordSource | null = null;
      const responseType: TResponseType = "pre-token";

      const response = await loginUser(
        username,
        password,
        usernameSource,
        passwordSource,
        responseType,
      );

      console.log("Login response:", response);

      if (!response.status || !response.data) {
        throw new Error(response.error || "Login failed");
      }

      const { accessToken, refreshToken, expiresIn, tokenType, ...userInfo } =
        response.data;

      login(
        { accessToken, refreshToken, expiresIn, tokenType },
        userInfo,
        loginMethods.manual,
      );

      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-2xl font-bold mb-6">Manual Login</h1>
            <p className="text-gray-600 mb-6">
              Login using your username and password. Requests are signed with
              RSA-PSS.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />
          </Card>
        </div>
      </main>
    </>
  );
}
