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
}

export interface PreTokenLoginResponse {
  preToken: string;
  expiresIn: number;
  message: string;
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

export type EUsernameSource = "Npk" | "Aol";
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

export type ResetProvider = "email" | "sms";
