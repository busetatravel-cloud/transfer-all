import "server-only";

import { getSupabaseAnonKey, getSupabaseConfig, getSupabaseServiceKey } from "@/lib/supabase-config";

export type SupabaseAuthUserRecord = {
  id: string;
  email: string;
  aud?: string;
  role?: string;
  confirmed_at?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type AuthJsonResponse<T> = {
  ok: boolean;
  status: number;
  rawText: string;
  data: T | null;
};

export type CreateAuthUserInput = {
  email: string;
  password: string;
  emailConfirm?: boolean;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};

export type CreateAuthUserResult = AuthJsonResponse<{
  user?: SupabaseAuthUserRecord;
  id?: string;
  email?: string;
}> & {
  user: SupabaseAuthUserRecord | null;
  duplicateEmail: boolean;
  errorMessage: string | null;
};

export type PasswordLoginResult = AuthJsonResponse<{
  user?: SupabaseAuthUserRecord;
  access_token?: string;
  refresh_token?: string;
}> & {
  user: SupabaseAuthUserRecord | null;
  errorMessage: string | null;
};

function getAuthBaseUrl() {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return `${config.url}/auth/v1`;
}

function getAdminKey() {
  return getSupabaseServiceKey() || "";
}

function getAnonymousKey() {
  return getSupabaseAnonKey() || getSupabaseServiceKey() || "";
}

async function readJsonResponse<T>(response: Response): Promise<AuthJsonResponse<T>> {
  const rawText = await response.text().catch(() => "");

  if (!rawText.trim()) {
    return {
      ok: response.ok,
      status: response.status,
      rawText: "",
      data: null,
    };
  }

  try {
    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data: JSON.parse(rawText) as T,
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data: null,
    };
  }
}

function extractAuthUser(data: unknown): SupabaseAuthUserRecord | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as {
    user?: SupabaseAuthUserRecord;
    id?: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    confirmed_at?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  };

  const user = record.user ?? (record.id && record.email ? record : null);

  if (!user) {
    return null;
  }

  if ("user" in record && record.user) {
    return record.user;
  }

  return {
    id: String(record.id ?? ""),
    email: String(record.email ?? ""),
    app_metadata: record.app_metadata ?? {},
    user_metadata: record.user_metadata ?? {},
    confirmed_at: record.confirmed_at ?? null,
    created_at: record.created_at ?? null,
    last_sign_in_at: record.last_sign_in_at ?? null,
  };
}

async function authFetch(
  path: string,
  init?: RequestInit,
  options?: { admin?: boolean; anonymous?: boolean },
) {
  const baseUrl = getAuthBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const key = options?.admin ? getAdminKey() : getAnonymousKey();

  if (!key) {
    return null;
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function isDuplicateEmailError(status: number, rawText: string) {
  return (
    status === 409 ||
    status === 422 ||
    /email already|already exists|duplicate key|User already exists/i.test(rawText)
  );
}

export async function createSupabaseAuthUser(input: CreateAuthUserInput): Promise<CreateAuthUserResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const serviceRoleExists = Boolean(getAdminKey().trim());

  console.info("supabase.auth.createUser.request", {
    action: "create_user",
    email: normalizedEmail,
    businessId: input.appMetadata?.businessId ?? input.userMetadata?.businessId ?? null,
    serviceRoleExists,
    emailConfirm: input.emailConfirm ?? true,
  });

  const response = await authFetch(
    "/admin/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: normalizedEmail,
        password: input.password,
        email_confirm: input.emailConfirm ?? true,
        app_metadata: input.appMetadata ?? {},
        user_metadata: input.userMetadata ?? {},
      }),
    },
    { admin: true },
  );

  if (!response) {
    return {
      ok: false,
      status: 0,
      rawText: "Supabase auth baglantisi kurulamadi.",
      data: null,
      user: null,
      duplicateEmail: false,
      errorMessage: "Supabase auth baglantisi kurulamadi.",
    };
  }

  const parsed = await readJsonResponse<{
    user?: SupabaseAuthUserRecord;
    id?: string;
    email?: string;
    message?: string;
    error?: string;
    msg?: string;
  }>(response);
  const user = extractAuthUser(parsed.data);
  const errorMessage =
    !response.ok && parsed.rawText
      ? ((): string => {
          try {
            const body = JSON.parse(parsed.rawText) as Record<string, unknown>;
            return String(body.msg ?? body.message ?? body.error ?? "");
          } catch {
            return parsed.rawText;
          }
        })()
      : null;

  console.info("supabase.auth.createUser.response", {
    action: "create_user",
    email: normalizedEmail,
    businessId: input.appMetadata?.businessId ?? input.userMetadata?.businessId ?? null,
    serviceRoleExists,
    status: response.status,
    ok: response.ok,
    message: errorMessage,
    createdAuthUserId: user?.id ?? null,
  });

  return {
    ...parsed,
    user,
    duplicateEmail: !response.ok && isDuplicateEmailError(response.status, parsed.rawText),
    errorMessage: response.ok ? null : errorMessage || "Auth user olusturulamadi.",
  };
}

export async function getSupabaseAuthUserById(userId: string) {
  const response = await authFetch(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: "GET" },
    { admin: true },
  );

  if (!response) {
    return {
      ok: false as const,
      status: 0,
      rawText: "Supabase auth baglantisi kurulamadi.",
      user: null as SupabaseAuthUserRecord | null,
    };
  }

  const parsed = await readJsonResponse<{
    user?: SupabaseAuthUserRecord;
    id?: string;
    email?: string;
  }>(response);

  return {
    ok: response.ok,
    status: response.status,
    rawText: parsed.rawText,
    user: extractAuthUser(parsed.data),
  };
}

export async function deleteSupabaseAuthUser(userId: string) {
  const response = await authFetch(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  }, { admin: true });

  if (!response) {
    return { ok: false as const, status: 0, rawText: "Supabase auth baglantisi kurulamadi." };
  }

  const parsed = await readJsonResponse<{ message?: string }>(response);
  return {
    ok: response.ok,
    status: response.status,
    rawText: parsed.rawText,
  };
}

export async function updateSupabaseAuthUserPassword(userId: string, password: string) {
  const response = await authFetch(
    `/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ password }),
    },
    { admin: true },
  );

  if (!response) {
    return { ok: false as const, status: 0, rawText: "Supabase auth baglantisi kurulamadi." };
  }

  const parsed = await readJsonResponse<{ user?: SupabaseAuthUserRecord }>(response);
  return {
    ok: response.ok,
    status: response.status,
    rawText: parsed.rawText,
    user: extractAuthUser(parsed.data),
  };
}

export async function signInWithSupabaseAuth(email: string, password: string): Promise<PasswordLoginResult> {
  const response = await authFetch(
    "/token?grant_type=password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: email.trim().toLowerCase(),
        password,
      }),
    },
    { admin: false, anonymous: true },
  );

  if (!response) {
    return {
      ok: false,
      status: 0,
      rawText: "Supabase auth baglantisi kurulamadi.",
      data: null,
      user: null,
      errorMessage: "Supabase auth baglantisi kurulamadi.",
    };
  }

  const parsed = await readJsonResponse<{
    user?: SupabaseAuthUserRecord;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    msg?: string;
  }>(response);

  return {
    ...parsed,
    user: extractAuthUser(parsed.data),
    errorMessage: response.ok
      ? null
      : (() => {
          try {
            const body = JSON.parse(parsed.rawText) as Record<string, unknown>;
            return String(body.msg ?? body.message ?? body.error ?? "Giris bilgileri hatali.");
          } catch {
            return parsed.rawText || "Giris bilgileri hatali.";
          }
        })(),
  };
}
