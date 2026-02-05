"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Button, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import { sendPasswordResetEmail, resetPassword } from "@/lib/client-api";

export default function EmailResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordToken, setPasswordToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setPasswordToken(token);
      setStep("reset");
    }
  }, [searchParams]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await sendPasswordResetEmail(email);

      if (result.status && result.data) {
        setSuccessMessage(
          "Password reset link has been sent to your email. Please check your inbox.",
        );
      } else {
        setError(result.error || "Failed to send reset email");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const result = await resetPassword(
        passwordToken,
        newPassword,
        confirmPassword,
        "email",
      );

      if (result.status && result.data) {
        setSuccessMessage("Password reset successful! Redirecting to login...");
        setTimeout(() => {
          router.push("/manual/login");
        }, 2000);
      } else {
        setError(result.error || "Failed to reset password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={false} onLogout={() => {}} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            {step === "request" ? (
              <>
                <h1 className="text-3xl font-bold mb-6">
                  Reset Password via Email
                </h1>
                <p className="text-gray-600 mb-6">
                  Enter your email address and we'll send you a link to reset
                  your password.
                </p>

                {successMessage && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    {successMessage}
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSendEmail} className="space-y-4">
                  <div>
                    <Input
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <LoadingSpinner />
                        <span className="ml-2">Sending...</span>
                      </span>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold mb-6">Create New Password</h1>
                <p className="text-gray-600 mb-6">
                  Enter your new password below.
                </p>

                {successMessage && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    {successMessage}
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <Input
                      label="New Password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <LoadingSpinner />
                        <span className="ml-2">Resetting...</span>
                      </span>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push("/reset-password")}
                className="text-blue-600 hover:text-blue-800"
              >
                Back to Reset Options
              </button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
