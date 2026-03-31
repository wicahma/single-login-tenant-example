import { encryptionConfig } from "@/config";
import CryptoJS from "crypto-js";

const saltHex = Buffer.from(encryptionConfig.saltKey, "utf8").toString("hex");
const salt = CryptoJS.enc.Hex.parse(saltHex);

const key = CryptoJS.PBKDF2(encryptionConfig.secretKey, salt, {
  keySize: 256 / 32,
  iterations: 65536,
  hasher: CryptoJS.algo.SHA256,
});

const makeUrlSafe = (str: string) => {
  return str?.replace("+", "-")?.replace(/\//g, "_")?.replace(/=+$/, "");
};

const revertUrlSafe = (str: string) => {
  let result = str?.replace(/-/g, "+")?.replace(/_/g, "/");

  while (result.length % 4) {
    result += "=";
  }
  return result;
};

export const encryptAES = (strToEncrypt: string) => {
  try {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(strToEncrypt),
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      },
    );

    const ivBase64 = CryptoJS.enc.Base64.stringify(iv);
    const ciphertextBase64 = encrypted.toString();
    const combined = `${ivBase64}:${ciphertextBase64}`;

    return encodeURIComponent(makeUrlSafe(combined));
  } catch (error) {
    return `Encryption failed: ${error}`;
  }
};

export const decryptAES = (strToDecrypt: string) => {
  try {
    const decoded = decodeURIComponent(strToDecrypt);
    const base64Str = revertUrlSafe(decoded);
    const [ivBase64, ciphertextBase64] = base64Str.split(":");

    if (!ivBase64 || !ciphertextBase64) {
      throw new Error("Invalid encrypted string format");
    }

    const iv = CryptoJS.enc.Base64.parse(ivBase64);
    const decrypted = CryptoJS.AES.decrypt(ciphertextBase64, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return `Decryption failed:${error}`;
  }
};
