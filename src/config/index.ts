export const ssoConfig = {
  ssoBaseUrl: process.env.SSO_BASE_URL || "http://localhost:4000",
  ssoServerUrl: process.env.SSO_BACKEND_BASE_URL || "http://localhost:4001",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
  scopes: "openid profile email offline_access",
  redirectUri: process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/oauth/callback`
    : "http://localhost:3000/oauth/callback",
};

export const manualAuthConfig = {
  ...ssoConfig,
  apiKey: process.env.API_KEY || "",
  appIdentifier: process.env.APP_IDENTIFIER || "",
  keyId: process.env.KEY_ID || "",
  privateKeyPem: process.env.PRIVATE_KEY_PEM || "",
  backendUrl: "/api",
  defaultUsernameSource: "npk",
  defaultPasswordSource: "",
};

export const storageKeys = {
  accessToken: "sso_access_token",
  refreshToken: "sso_refresh_token",
  tokenExpiry: "sso_token_expiry",
  userData: "sso_user_data",
  oauthSession: "oauth_session",
  loginMethod: "sso_login_method",
};

export type LoginMethod = "oauth" | "manual";

export const loginMethods = {
  oauth: "oauth" as LoginMethod,
  manual: "manual" as LoginMethod,
};
