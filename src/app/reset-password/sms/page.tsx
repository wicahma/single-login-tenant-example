"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, LoadingSpinner } from "@/components/atoms";
import { Header } from "@/components/organisms";
import {
  sendPasswordResetSms,
  validateSmsOtp,
  resetPassword,
} from "@/lib/client-api";

type Step = "phone" | "otp" | "password";

export default function SmsResetPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordToken, setPasswordToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [maskedOtp, setMaskedOtp] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await sendPasswordResetSms(phoneNumber);

      if (result.status && result.data) {
        setMaskedOtp(result.data.maskedOtp);
        setOtpExpiresIn(result.data.expiresInMinutes);
        setSuccessMessage(
          `OTP sent successfully! Code expires in ${result.data.expiresInMinutes} minutes.`,
        );
        setCurrentStep("otp");
      } else {
        setError(result.error || "Failed to send SMS");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await validateSmsOtp(phoneNumber, otpCode);

      if (result.status && result.data) {
        setPasswordToken(result.data.passwordToken);
        setSuccessMessage("OTP verified successfully!");
        setCurrentStep("password");
      } else {
        setAttempts(attempts + 1);
        setError(
          result.error || `Invalid OTP code. Attempts: ${attempts + 1}/3`,
        );
        if (attempts >= 2) {
          setError("Maximum attempts reached. Please request a new OTP code.");
          setTimeout(() => {
            setCurrentStep("phone");
            setAttempts(0);
            setOtpCode("");
          }, 3000);
        }
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
        "sms",
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

  const renderStepIndicator = () => {
    const steps = [
      { id: "phone", label: "Phone Number" },
      { id: "otp", label: "Verify OTP" },
      { id: "password", label: "New Password" },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between gap-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep === step.id
                      ? "bg-blue-600 text-white"
                      : steps.findIndex((s) => s.id === currentStep) > index
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {steps.findIndex((s) => s.id === currentStep) > index ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs text-center mt-2 text-nowrap ${
                    currentStep === step.id
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Header isAuthenticated={false} onLogout={() => {}} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <h1 className="text-3xl font-bold mb-6">Reset Password via SMS</h1>

            {renderStepIndicator()}

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

            {currentStep === "phone" && (
              <>
                <p className="text-gray-600 mb-6">
                  Enter your phone number to receive an OTP code.
                </p>
                <form onSubmit={handleSendSms} className="space-y-4">
                  <div>
                    <Input
                      label="Phone Number"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max 3 attempts per 30 minutes
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <LoadingSpinner />
                        <span className="ml-2">Sending...</span>
                      </span>
                    ) : (
                      "Send OTP Code"
                    )}
                  </Button>
                </form>
              </>
            )}

            {currentStep === "otp" && (
              <>
                <p className="text-gray-600 mb-2">
                  Enter the OTP code sent to your phone number.
                </p>
                {maskedOtp && (
                  <p className="text-sm text-gray-500 mb-6">
                    Code hint: {maskedOtp} (expires in {otpExpiresIn} minutes)
                  </p>
                )}
                <form onSubmit={handleValidateOtp} className="space-y-4">
                  <div>
                    <Input
                      label="OTP Code"
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter OTP code"
                      required
                      disabled={isLoading}
                      maxLength={6}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      Max 3 wrong attempts allowed
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <LoadingSpinner />
                        <span className="ml-2">Verifying...</span>
                      </span>
                    ) : (
                      "Verify OTP"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setCurrentStep("phone");
                      setOtpCode("");
                      setAttempts(0);
                      setError(null);
                    }}
                    disabled={isLoading}
                  >
                    Request New Code
                  </Button>
                </form>
              </>
            )}

            {currentStep === "password" && (
              <>
                <p className="text-gray-600 mb-6">
                  Create your new password below.
                </p>
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
