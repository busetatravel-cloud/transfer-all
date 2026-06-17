import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/password";
import { findUserByEmail } from "@/lib/business";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE_NAME,
  type SessionPayload,
  type SessionRole,
  verifySessionToken,
} from "@/lib/session";
import { getLandingPath } from "@/lib/platform";

export type BusinessSessionPayload = SessionPayload & {
  businessId: string;
};

export async function resolveAuthRecord(email: string) {
  return findUserByEmail(email);
}

export async function authenticate(email: string, password: string) {
  const record = await resolveAuthRecord(email);

  if (!record || !record.active) {
    return null;
  }

  if (!verifyPassword(password, record.passwordHash)) {
    return null;
  }

  if (record.role === "BUSINESS_ADMIN" && !record.businessId) {
    return null;
  }

  return {
    userId: record.id,
    role: record.role,
    businessId: record.businessId,
    email: record.email,
  } satisfies SessionPayload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  return verifySessionToken(token, getSessionSecret());
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(role: SessionRole) {
  const session = await requireSession();

  if (session.role !== role) {
    redirect(getLandingPath(session.role));
  }

  return session;
}

export async function requireApiRole(role: SessionRole) {
  const session = await getSession();

  if (!session) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (session.role !== role) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, session };
}

export async function requireApiBusinessSession() {
  const auth = await requireApiRole("BUSINESS_ADMIN");

  if (!auth.ok) {
    return auth;
  }

  if (!auth.session.businessId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    session: auth.session as BusinessSessionPayload,
  };
}

export async function requireBusinessSession(): Promise<BusinessSessionPayload> {
  const session = await requireRole("BUSINESS_ADMIN");

  if (!session.businessId) {
    redirect("/login");
  }

  return session as BusinessSessionPayload;
}

export function createLoginToken(payload: SessionPayload) {
  return createSessionToken(payload, getSessionSecret());
}
