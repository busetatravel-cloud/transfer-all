import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, derivedHex] = storedHash.split("$");

  if (scheme !== "scrypt" || !salt || !derivedHex) {
    return false;
  }

  const derivedKey = Buffer.from(derivedHex, "hex");
  const actualKey = scryptSync(password, salt, derivedKey.length);

  return timingSafeEqual(actualKey, derivedKey);
}
