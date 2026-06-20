import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail, getBusinessById, syncBusinessAdminFromAuthLogin } from "@/lib/business";
import { signInWithSupabaseAuth } from "@/lib/supabase-auth";
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

export type LoginFlowResult = {
  ok: boolean;
  currentStep: string;
  authError: boolean;
  authMessage: string | null;
  sessionCreated: boolean;
  session: SessionPayload | null;
  authUserId: string | null;
};

export async function resolveAuthRecord(email: string) {
  return findUserByEmail(email.trim().toLowerCase());
}

export async function authenticate(email: string, password: string): Promise<LoginFlowResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const authResult = await signInWithSupabaseAuth(normalizedEmail, password);
  console.log("auth.login.auth_result", {
    step: "auth_response_received",
    email: normalizedEmail,
    hasPassword: Boolean(password),
    authError: Boolean(authResult.errorMessage),
    authErrorMessage: authResult.errorMessage,
    authUserId: authResult.user?.id ?? null,
    sessionExists: Boolean((authResult.data as Record<string, unknown> | null)?.access_token),
  });

  if (!authResult.user) {
    return {
      ok: false,
      currentStep: "auth_response_failed",
      authError: true,
      authMessage: authResult.errorMessage ?? "Giris bilgileri hatali.",
      sessionCreated: false,
      session: null,
      authUserId: null,
    };
  }

  let record;

  try {
    record = await syncBusinessAdminFromAuthLogin(authResult.user, password);
  } catch (error) {
    return {
      ok: false,
      currentStep: "sync_failed",
      authError: true,
      authMessage: error instanceof Error ? error.message : "Giris islemi tamamlanamadi.",
      sessionCreated: false,
      session: null,
      authUserId: authResult.user.id,
    };
  }

  if (!record || !record.active || record.deletedAt) {
    return {
      ok: false,
      currentStep: "user_inactive",
      authError: true,
      authMessage: "Hesap pasif veya silinmis.",
      sessionCreated: false,
      session: null,
      authUserId: authResult.user.id,
    };
  }

  if (record.role === "BUSINESS_ADMIN" && !record.businessId) {
    return {
      ok: false,
      currentStep: "business_missing",
      authError: true,
      authMessage: "Business baglantisi bulunamadi.",
      sessionCreated: false,
      session: null,
      authUserId: authResult.user.id,
    };
  }

  if (record.role === "BUSINESS_ADMIN" && record.businessId) {
    const business = await getBusinessById(record.businessId);
    if (!business || !business.active) {
      return {
        ok: false,
        currentStep: "business_inactive",
        authError: true,
        authMessage: "Business aktif degil.",
        sessionCreated: false,
        session: null,
        authUserId: authResult.user.id,
      };
    }
  }

  return {
    ok: true,
    currentStep: "completed",
    authError: false,
    authMessage: null,
    sessionCreated: true,
    session: {
      userId: record.id,
      role: record.role,
      businessId: record.businessId,
      email: record.email.toLowerCase(),
    } satisfies SessionPayload,
    authUserId: authResult.user.id,
  };
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
