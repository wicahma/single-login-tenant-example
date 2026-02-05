"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/atoms";
import { Header } from "@/components/organisms";

export default function ResetPasswordPage() {
  const router = useRouter();

  const handleMethodSelect = (method: "email" | "sms") => {
    if (method === "email") {
      router.push("/reset-password/email");
    } else {
      router.push("/reset-password/sms");
    }
  };

  return (
    <>
      <Header isAuthenticated={false} onLogout={() => {}} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-3xl font-bold mb-6">Reset Password</h1>
            <p className="text-gray-600 mb-6">
              Choose how you would like to reset your password
            </p>

            <div className="space-y-4">
              <button
                onClick={() => handleMethodSelect("email")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center">
                  <svg
                    className="w-8 h-8 text-blue-600 mr-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-lg">Reset via Email</h3>
                    <p className="text-sm text-gray-600">
                      Receive a reset link via email
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect("sms")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center">
                  <svg
                    className="w-8 h-8 text-blue-600 mr-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-lg">Reset via SMS</h3>
                    <p className="text-sm text-gray-600">
                      Receive an OTP code via SMS
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push("/manual/login")}
                className="text-blue-600 hover:text-blue-800"
              >
                Back to Login
              </button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
