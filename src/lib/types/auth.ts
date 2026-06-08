export interface SSOConfig {
  ssoBaseUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
}

export interface ManualAuthConfig extends SSOConfig {
  apiKey: string;
  appIdentifier: string;
  keyId: string;
  privateKeyPem: string;
  backendUrl: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  idToken?: string;
  refreshToken: string;
  tokenType: string;
  // Microsoft session (present only when the tenant has Microsoft SSO configured)
  microsoftAccessToken?: string | null;
  microsoftExpiresIn?: number;
  /** True when Entra ID enforced MFA at login time and no MS token was issued via ROPC */
  microsoftMfaRequired?: boolean;
}

export interface RefreshMicrosoftTokenData {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface PreTokenLoginResponse {
  preToken: string;
  expiresIn: number;
  message: string;
  passwordExpiresAt: string;
  mfaEnrollment: {
    requiredToMFA: boolean;
    isEnrolledMFA: boolean;
    reason?: string;
  };
}

export interface TenantLoginResponse {
  email: string;
  fullName: string;
  phoneNumber: string;
  npk: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  passwordExpiresAt?: Date;
}

export interface UserInfo {
  sub: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  phoneNumberVerified: boolean;
  preferredUsername: string;
  application: {
    id: number;
    appName: string;
    appIdentifier: string;
    isActive: boolean;
  };
  works: UserWorkData[];
  aolUserDetail: string | null;
}

export interface UserWorkData {
  workId: number;
  position: {
    id: number;
    name: string;
    hcId: number;
  };
  branch: {
    id: number;
    name: string;
    code: string;
  };
  department: {
    id: number;
    name: string;
    hcId: number;
  };
  company: {
    id: number;
    name: string;
    hcId: number;
  };
  uamData: {
    uamId: number;
    applicationId: number;
    groupName: string;
    detailData: {
      detailId: number;
      charValue1: string | null;
      charValue2: string | null;
      charValue3: string | null;
      charValue4: string | null;
      charValue5: string | null;
      charValue6: string | null;
      charValue7: string | null;
      charValue8: string | null;
      charValue9: string | null;
      charValue10: string | null;
      template: {
        templateId: number;
        charValue1Label: string | null;
        charValue2Label: string | null;
        charValue3Label: string | null;
        charValue4Label: string | null;
        charValue5Label: string | null;
        charValue6Label: string | null;
        charValue7Label: string | null;
        charValue8Label: string | null;
        charValue9Label: string | null;
        charValue10Label: string | null;
      };
    };
  };
  isActive: boolean;
  expiredAt: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthSession {
  codeVerifier: string;
  state: string;
  nonce: string;
}

export type EUsernameSource = "Npk" | "Email";
export type EPasswordSource = "Cms";
export type TResponseType = "default" | "pre-token";

export interface TokenValidationResponse {
  isValid: boolean;
  tokenType: string;
  message?: string | null;
}

export interface UpdateProfileRequest {
  fullName: string;
  phoneNumber: string;
}

export interface PasswordResetEmailRequest {
  email: string;
}

export interface PasswordResetSmsRequest {
  phoneNumber: string;
}

export interface PasswordResetSmsResponse {
  message: string;
  maskedOtp: string;
  expiresInMinutes: number;
}

export interface ValidateSmsOtpRequest {
  phoneNumber: string;
  otpCode: string;
}

export interface ValidateSmsOtpResponse {
  message: string;
  passwordToken: string;
  tokenExpiresInMinutes: number;
}

export interface PasswordResetRequest {
  passwordToken: string;
  newPassword: string;
  reNewPassword: string;
}

export type ResetProvider = "email" | "sms" | "email-otp";

export interface PasswordResetEmailOtpRequest {
  email: string;
}

export interface PasswordResetEmailOtpResponse {
  message: string;
  expiresInMinutes: number;
}

export interface ValidateEmailOtpResponse {
  message: string;
  passwordToken: string;
  tokenExpiresInMinutes: number;
}

// ─── Public API: /public/me/profile, /public/me/works, /public/me/uam ───────

export interface ApplicationInfo {
  id: number;
  appName: string;
  appIdentifier: string;
  isActive: boolean;
}

export interface UserProfileData {
  id: number;
  email: string;
  fullName: string;
  phoneNumber: string;
  npk: string;
  application: ApplicationInfo | null;
}

export interface PositionInfo {
  id: number;
  name: string;
  hcId: number | null;
}

export interface BranchInfo {
  id: number;
  name: string;
  code: string;
}

export interface DepartmentInfo {
  id: number;
  name: string;
  hcId: number | null;
}

export interface CompanyInfo {
  id: number;
  name: string;
  hcId: number | null;
}

export interface GroupInfo {
  id: number;
  groupName: string;
  groupSource: number;
  groupSourceName: string;
}

export interface UserWorkInfo {
  workId: number | null;
  uamAolId: number | null;
  position: PositionInfo;
  branch: BranchInfo;
  department: DepartmentInfo;
  company: CompanyInfo;
  group: GroupInfo | null;
  uamData: null;
  isActive: boolean;
  expiredAt: string | null;
}

export interface MenuPermissionResponse {
  menuId: number;
  menuName: string;
  isView: boolean;
  isCreate: boolean;
  isUpdate: boolean;
  isEdit: boolean;
  isDelete: boolean;
  isDownload: boolean;
}

export interface UamInfo {
  uamId: number;
  applicationId: number;
  menuInfo: MenuPermissionResponse[] | null;
  detailData: Record<string, string> | null;
}

export interface AolUserDetailInfo {
  codeSp: string;
  email: string;
  flagActive: string;
  groupUser: string;
  idUser: string;
  nameUser: string;
  npk: string;
  phoneNumber: string;
}

// ─── MFA Recovery types ──────────────────────────────────────────────────────

/** Standard backend envelope used for all success and most error responses */
export interface RBaseResponse<T> {
  status: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  pagination?: RPaginatedResponse;
  metadata?: Record<string, unknown>;
}

export interface RPaginatedResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Shape returned ONLY when the backend hits an MFA challenge.
 * This is NOT wrapped in RBaseResponse — it comes directly as the 401 body.
 */
export interface MfaRequiredError {
  error: "mfa_required";
  message: string;
}

/**
 * Token data returned inside RBaseResponse from both
 * /refresh-microsoft-token and /recover-microsoft-session.
 */
export interface MicrosoftTokenData {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/** Request body for POST /api/auth/recover-microsoft-session */
export interface RecoverMicrosoftSessionRequest {
  authorizationCode: string;
  redirectUri: string;
}

export interface UserUamWorkInfo {
  workId: number | null;
  position: PositionInfo;
  branch: BranchInfo;
  department: DepartmentInfo;
  company: CompanyInfo;
  group: GroupInfo | null;
  uamData: UamInfo | null;
  isActive: boolean;
  expiredAt: string | null;
  aolDetail: AolUserDetailInfo | null;
}
