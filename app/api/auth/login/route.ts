import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { findUserByAuthUserId, findUserByEmail } from "@/lib/business";
import { createLoginToken } from "@/lib/auth";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return Response.json({ error: "missing_credentials" }, { status: 400 });
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        { error: "supabase_config_missing" },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Best-effort cookie sync.
          }
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    const authUserId = data.user?.id ?? null;
    const emailLookup = await findUserByEmail(email.trim());
    const authLookup = authUserId ? await findUserByAuthUserId(authUserId) : null;
    const userRecord = authLookup ?? emailLookup;

    if (!userRecord) {
      return Response.json(
        {
          error: "role_not_found",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      userId: authUserId,
      role: userRecord.role,
      businessId: userRecord.businessId,
    });

    const sessionToken = createLoginToken({
      userId: userRecord.id,
      role: userRecord.role,
      businessId: userRecord.businessId,
      email: userRecord.email,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return Response.json(
      {
        error: "invalid_request_body",
        message: String(error),
      },
      { status: 400 },
    );
  }
}
