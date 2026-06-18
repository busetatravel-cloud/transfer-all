import "server-only";

export type SupabaseConfig = {
  url: string;
  serviceKey: string;
};

export function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  )
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
}

export function getSupabaseAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function getSupabaseServiceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  return { url, serviceKey };
}

export function hasSupabaseConnection() {
  return getSupabaseConfig() !== null;
}
