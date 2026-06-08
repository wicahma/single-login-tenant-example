export interface IEnrollUserResponse {
  setupKey: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}
