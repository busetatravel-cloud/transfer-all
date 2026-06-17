import { NextResponse } from "next/server";
import { authenticate, createLoginToken } from "@/lib/auth";
import { getLandingPath } from "@/lib/platform";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email ve sifre gerekli." },
      { status: 400 },
    );
  }

  const session = await authenticate(email, password);

  if (!session) {
    return NextResponse.json(
      { error: "Giris bilgileri hatali." },
      { status: 401 },
    );
  }

  const token = createLoginToken(session);
  const response = NextResponse.json({
    ok: true,
    role: session.role,
    redirectTo: getLandingPath(session.role),
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
