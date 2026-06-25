import { NextResponse } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DebugFetchResult = {
  count: number | null;
  error: {
    code: string;
    message: string;
    status: number;
    rawText: string;
  } | null;
};

function getUrlHost() {
  const url = getSupabaseUrl();

  if (!url) {
    return null;
  }

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function fetchBusinessCount(apiKey: string | null): Promise<DebugFetchResult> {
  const url = getSupabaseUrl();

  if (!url || !apiKey) {
    return {
      count: null,
      error: {
        code: "env_missing",
        message: !url
          ? "Supabase URL tanimli degil."
          : "Supabase API key tanimli degil.",
        status: 0,
        rawText: "",
      },
    };
  }

  let response: Response;

  try {
    response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/businesses?select=id`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    return {
      count: null,
      error: {
        code: "network_error",
        message: error instanceof Error ? error.message : "Supabase baglantisi kurulamadı.",
        status: 503,
        rawText: "",
      },
    };
  }

  const rawText = await response.text().catch(() => "");
  const trimmed = rawText.trim();

  if (!response.ok) {
    let code = "supabase_error";
    let message = trimmed || "Supabase sorgusu basarisiz oldu.";

    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        code = String(parsed.code ?? parsed.error ?? code);
        message = String(parsed.message ?? parsed.msg ?? parsed.error ?? message);
      } catch {
        message = trimmed;
      }
    }

    return {
      count: null,
      error: {
        code,
        message,
        status: response.status,
        rawText,
      },
    };
  }

  if (!trimmed) {
    return { count: 0, error: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return {
      count: Array.isArray(parsed) ? parsed.length : 0,
      error: null,
    };
  } catch {
    return {
      count: null,
      error: {
        code: "supabase_parse_error",
        message: "Supabase yaniti JSON olarak okunamadi.",
        status: response.status,
        rawText,
      },
    };
  }
}

export async function GET() {
  const serviceRoleKey = getSupabaseServiceKey();
  const anonKey = getSupabaseAnonKey();

  const [serviceRole, anon] = await Promise.all([
    fetchBusinessCount(serviceRoleKey),
    fetchBusinessCount(anonKey),
  ]);

  return NextResponse.json({
    hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasSupabaseServiceRoleKey: Boolean(serviceRoleKey),
    hasSupabaseAnonKey: Boolean(anonKey),
    supabaseUrlHost: getUrlHost(),
    serviceRole,
    anon,
  });
}
