import { createHmac } from "node:crypto";

export type SessionRole = "SUPER_ADMIN" | "BUSINESS_ADMIN";

export type SessionPayload = {
  userId: string;
  role: SessionRole;
  businessId: string | null;
  email: string;
};

export const SESSION_COOKIE_NAME = "transfer_saas_session";

export function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(
  payload: SessionPayload,
  secret = getSessionSecret(),
) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  secret = getSessionSecret(),
) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload, secret);

  if (expected !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;

    if (
      !payload ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "SUPER_ADMIN" && payload.role !== "BUSINESS_ADMIN")
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
