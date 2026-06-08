import { PreTokenLoginResponse } from "@/lib/types/auth";

const mfaSessionStorageKey = "mfa_session";
const mfaFingerprintStorageKey = "mfa_fingerprint";

export interface StoredMfaSession {
  identifier: string;
  userName: string;
  preToken: string;
  expiresIn: number;
  startedAt: number;
  mfaEnrollment: PreTokenLoginResponse["mfaEnrollment"];
}

export function saveMfaSession(
  session: Omit<StoredMfaSession, "startedAt">,
): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    mfaSessionStorageKey,
    JSON.stringify({
      ...session,
      startedAt: Date.now(),
    } satisfies StoredMfaSession),
  );
}

export function readMfaSession(): StoredMfaSession | null {
  if (typeof window === "undefined") return null;

  const rawSession = localStorage.getItem(mfaSessionStorageKey);
  if (!rawSession) return null;

  try {
    const parsedSession = JSON.parse(rawSession) as StoredMfaSession;
    if (!parsedSession.preToken || !parsedSession.identifier) {
      clearMfaSession();
      return null;
    }

    const expiresAt = parsedSession.startedAt + parsedSession.expiresIn * 1000;
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      clearMfaSession();
      return null;
    }

    return parsedSession;
  } catch {
    clearMfaSession();
    return null;
  }
}

export function clearMfaSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(mfaSessionStorageKey);
}

export function getMfaNextRoute(isEnrolledMFA: boolean): string {
  return isEnrolledMFA ? "/mfa/verify" : "/mfa/enroll";
}

export function getOrCreateMfaFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const existingFingerprint = localStorage.getItem(mfaFingerprintStorageKey);
  if (existingFingerprint) {
    return existingFingerprint;
  }

  const generatedFingerprint =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mfa-${Date.now()}`;

  localStorage.setItem(mfaFingerprintStorageKey, generatedFingerprint);
  return generatedFingerprint;
}
