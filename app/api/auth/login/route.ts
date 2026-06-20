import { NextResponse } from "next/server";
import { authenticate, createLoginToken } from "@/lib/auth";
import { getLandingPath } from "@/lib/platform";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: Request) {
  try {
    let body: { email?: string; password?: string };

    try {
      body = (await req.json()) as { email?: string; password?: string };
    } catch (error) {
      return Response.json(
        {
          error: "invalid_request_body",
          message: String(error),
        },
        { status: 400 },
      );
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return Response.json(
        {
          ok: false,
          error: "missing_credentials",
        },
        { status: 400 },
      );
    }

    const result = await authenticate(email, password);

    if (!result.ok || !result.session) {
      return Response.json(
        {
          ok: false,
          currentStep: result.currentStep,
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
      currentStep: result.currentStep,
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
    return Response.json(
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
