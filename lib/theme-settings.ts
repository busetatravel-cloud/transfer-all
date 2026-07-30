import "server-only";

import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { DEFAULT_THEME_KEY, getThemeRegistryEntry } from "@/lib/theme-registry";
import type { ThemeSettings } from "@/lib/theme-types";

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function mapThemeSettings(row: Record<string, unknown>): ThemeSettings {
  // template_key registry'de tanımlı değilse (silinmiş/henüz eklenmemiş bir tema)
  // getThemeRegistryEntry güvenli şekilde varsayılan temaya düşer; ham DB değeri
  // hiçbir zaman doğrudan kullanılmaz.
  const templateKey = getThemeRegistryEntry(String(row.template_key ?? DEFAULT_THEME_KEY)).key;

  return {
    templateKey,
    primaryColor: String(row.primary_color ?? ""),
    secondaryColor: String(row.secondary_color ?? ""),
    backgroundColor: String(row.background_color ?? ""),
    surfaceColor: String(row.surface_color ?? ""),
    textColor: String(row.text_color ?? ""),
    borderRadius: (String(row.border_radius ?? "lg") as ThemeSettings["borderRadius"]),
    shadow: (String(row.shadow ?? "soft") as ThemeSettings["shadow"]),
    fontFamily: String(row.font_family ?? ""),
    colorMode: (String(row.color_mode ?? "light") as ThemeSettings["colorMode"]),
  };
}

// Şimdilik hiçbir işletmenin business_theme_settings kaydı yok (seçim UI'ı bu fazda
// yapılmıyor); bu fonksiyon yine de gerçek tabloyu sorgular ve yalnızca kayıt
// bulunamadığında registry varsayılanına düşer — böylece bir sonraki fazda tema
// seçimi eklendiğinde bu fonksiyon değişmeden gerçek veriyi döndürmeye başlar.
export async function getBusinessThemeSettings(
  businessId: string | null | undefined,
): Promise<ThemeSettings> {
  const fallback = getThemeRegistryEntry(DEFAULT_THEME_KEY).settings;

  if (!businessId || !hasSupabaseConnection()) {
    return fallback;
  }

  try {
    const response = await supabaseFetch(
      `/business_theme_settings?select=template_key,primary_color,secondary_color,background_color,surface_color,text_color,border_radius,shadow,font_family,color_mode&business_id=eq.${encodeURIComponent(
        businessId,
      )}&limit=1`,
    );

    if (!response?.ok) {
      return fallback;
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapThemeSettings(rows[0]) : fallback;
  } catch {
    return fallback;
  }
}

// Bir işletme tema seçtiğinde, registry'deki o temanın TÜM ayarları business_theme_settings
// satırına kopyalanır (yalnızca template_key değil) — böylece satır her zaman kendi içinde
// tutarlı kalır ve getBusinessThemeSettings ek bir registry birleştirmesi yapmadan
// doğrudan doğru değerleri okuyabilir. templateKey burada da registry'ye karşı doğrulanır;
// bilinmeyen bir anahtar sessizce "modern"e düşer.
export async function saveBusinessThemeSettings(
  businessId: string,
  templateKey: string,
): Promise<ThemeSettings> {
  const entry = getThemeRegistryEntry(templateKey);
  const settings = entry.settings;

  if (!hasSupabaseConnection()) {
    return settings;
  }

  const payload = {
    business_id: businessId,
    template_key: settings.templateKey,
    primary_color: settings.primaryColor,
    secondary_color: settings.secondaryColor,
    background_color: settings.backgroundColor,
    surface_color: settings.surfaceColor,
    text_color: settings.textColor,
    border_radius: settings.borderRadius,
    shadow: settings.shadow,
    font_family: settings.fontFamily,
    color_mode: settings.colorMode,
  };

  const existing = await supabaseFetch(
    `/business_theme_settings?select=business_id&business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
  );
  const existingRows = existing?.ok
    ? ((await existing.json().catch(() => [])) as Array<Record<string, unknown>>)
    : [];

  const response = existingRows.length
    ? await supabaseFetch(
        `/business_theme_settings?business_id=eq.${encodeURIComponent(businessId)}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      )
    : await supabaseFetch(`/business_theme_settings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

  if (!response?.ok) {
    throw new Error("Tema ayarları kaydedilemedi.");
  }

  return settings;
}
