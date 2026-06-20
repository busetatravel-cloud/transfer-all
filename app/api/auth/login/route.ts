import { NextResponse } from "next/server";
import { authenticate, createLoginToken } from "@/lib/auth";
import { getLandingPath } from "@/lib/platform";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;

    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    let currentStep = "entered";

    console.log({
      step: currentStep,
      email,
      hasPassword: Boolean(password),
      authError: null,
      authErrorMessage: null,
      authUserId: null,
      sessionExists: false,
    });

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          currentStep: "validation_failed",
          authError: true,
          authMessage: "Email ve sifre gerekli.",
          sessionCreated: false,
        },
        { status: 400 },
      );
    }

    const result = await authenticate(email, password);
    currentStep = result.currentStep;

    console.log({
      step: currentStep,
      email,
      hasPassword: Boolean(password),
      authError: result.authError,
      authErrorMessage: result.authMessage,
      authUserId: result.authUserId,
      sessionExists: result.sessionCreated,
    });

    if (!result.ok || !result.session) {
      return NextResponse.json(
        {
          ok: false,
          currentStep,
          authError: true,
          authMessage: result.authMessage ?? "Giris islemi tamamlanamadi.",
          sessionCreated: false,
        },
        { status: 401 },
      );
    }

    const token = createLoginToken(result.session);
    const response = NextResponse.json({
      ok: true,
      currentStep,
      authError: false,
      authMessage: null,
      sessionCreated: true,
      role: result.session.role,
      redirectTo: getLandingPath(result.session.role),
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("/api/auth/login error:", error);
    return NextResponse.json(
      {
        ok: false,
        currentStep: "exception",
        authError: true,
        authMessage: error instanceof Error ? error.message : "Login islemi su anda tamamlanamadi.",
        sessionCreated: false,
      },
      { status: 500 },
    );
  }
}
