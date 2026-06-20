import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };

    const normalizedEmail = email?.trim();

    if (!normalizedEmail || !password) {
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
            // Route handler cookie write best-effort.
          }
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json({
      ok: true,
      userId: data.user?.id ?? null,
    });
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
