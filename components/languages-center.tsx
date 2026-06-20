"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildTranslationSeeds, getSectionLabel, type TranslationPanelShape } from "@/lib/content-translations-client";
import {
  SECTION_FIELD_LABELS,
  type TranslationDraftRecord,
  type TranslationSection,
} from "@/lib/translation-schema";
import {
  getLanguageLabel,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from "@/lib/languages";

type LanguagesCenterProps = {
  businessId: string;
  panel: ClientPanelData;
  drafts: TranslationDraftRecord[];
  aiEnabled: boolean;
  aiModel: string;
};

type ClientPanelData = TranslationPanelShape & {
  seo: TranslationPanelShape["seo"] & {
    businessId: string;
    canonicalUrl: string;
    defaultLocale: string;
    hreflangEnabled: boolean;
  };
  locales: Array<{
    id: string;
    businessId: string;
    code: string;
    name: string;
    active: boolean;
    published: boolean;
    translationComplete: boolean;
  }>;
};

type ActionState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type ProgressState = {
  running: boolean;
  completed: number;
  total: number;
  currentLocale: string;
};

type LocaleSummary = {
  locale: SupportedLanguageCode;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  active: boolean;
  isDefault: boolean;
  draftCount: number;
  totalFields: number;
  completedFields: number;
  missingFields: number;
  completion: number;
  status: "bekliyor" | "kısmi" | "tam" | "pasif";
  lastTranslationAt: string | null;
  missingItems: MissingItem[];
};

type MissingItem = {
  section: TranslationSection;
  sectionLabel: string;
  fieldKey: string;
  fieldLabel: string;
  sourceId: string;
  sourceText: string;
};

type DraftMapEntry = {
  translatedText: string;
  updatedAt: string;
  createdAt: string;
};

type ApiErrorBody = {
  ok?: boolean;
  code?: string;
  message?: string;
  rawText?: string;
  status?: number;
  languageCode?: string;
  section?: string;
  sectionLabel?: string;
  fieldKey?: string;
  sourceId?: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function readResponseBody(response: Response) {
  return response.text().catch(() => "");
}

function parseMaybeJson(rawText: string) {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as ApiErrorBody | { ok?: boolean; data?: unknown } | string;
  } catch {
    return rawText;
  }
}

function formatApiError(body: unknown, status: number) {
  if (typeof body === "string") {
    return body;
  }

  if (!body || typeof body !== "object") {
    return `İşlem başarısız. (${status})`;
  }

  const payload = body as ApiErrorBody;
  const pieces: string[] = [];

  if (payload.languageCode) {
    pieces.push(getLanguageLabel(payload.languageCode));
  }

  if (payload.sectionLabel || payload.section) {
    pieces.push(payload.sectionLabel ?? String(payload.section));
  }

  if (payload.fieldKey) {
    pieces.push(payload.fieldKey);
  }

  if (payload.sourceId) {
    pieces.push(payload.sourceId);
  }

  const message = payload.message || payload.code || `İşlem başarısız. (${status})`;
  const detail = pieces.length ? ` — ${pieces.join(" / ")}` : "";
  const raw = payload.rawText?.trim() ? `\n${payload.rawText}` : "";

  return `${message}${detail}${raw}`;
}

function makeSeedKey(
  locale: string,
  section: TranslationSection,
  sourceId: string,
  fieldKey: string,
) {
  return `${locale}:${section}:${sourceId}:${fieldKey}`;
}

function getFieldLabel(section: TranslationSection, fieldKey: string) {
  const sectionLabels = SECTION_FIELD_LABELS[section];
  const label = String(sectionLabels?.[fieldKey as never] ?? "").trim();
  return label || fieldKey;
}

function compareDates(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

export function LanguagesCenter({ businessId, panel, drafts, aiEnabled, aiModel }: LanguagesCenterProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ status: "idle", message: "" });
  const [progress, setProgress] = useState<ProgressState>({
    running: false,
    completed: 0,
    total: 0,
    currentLocale: "",
  });
  const [selectedLocale, setSelectedLocale] = useState<SupportedLanguageCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const seedsBySection = useMemo(() => buildTranslationSeeds(panel), [panel]);
  const allSeeds = useMemo(() => Object.values(seedsBySection).flat(), [seedsBySection]);
  const localeMap = useMemo(() => {
    const map = new Map<string, (typeof panel.locales)[number]>();
    for (const locale of panel.locales) {
      map.set(locale.code.toLowerCase(), locale);
    }
    return map;
  }, [panel]);

  const draftLookup = useMemo(() => {
    const map = new Map<string, DraftMapEntry>();

    for (const draft of drafts) {
      map.set(makeSeedKey(draft.localeCode, draft.section, draft.sourceId, draft.fieldKey), {
        translatedText: draft.translatedText,
        updatedAt: draft.updatedAt,
        createdAt: draft.createdAt,
      });
    }

    return map;
  }, [drafts]);

  const localeSummaries = useMemo<LocaleSummary[]>(() => {
    return SUPPORTED_LANGUAGES.map((language) => {
      const existing = localeMap.get(language.code);
      const localeDrafts = drafts.filter((draft) => draft.localeCode === language.code);
      const translatedDrafts = localeDrafts
        .filter((draft) => draft.translatedText.trim())
        .sort((left, right) => compareDates(left.updatedAt || left.createdAt, right.updatedAt || right.createdAt));

      const missingItems: MissingItem[] = [];
      let completedFields = 0;

      for (const seed of allSeeds) {
        const current = draftLookup.get(
          makeSeedKey(language.code, seed.section, seed.sourceId, seed.fieldKey),
        );
        if (current?.translatedText.trim()) {
          completedFields += 1;
          continue;
        }

        missingItems.push({
          section: seed.section,
          sectionLabel: getSectionLabel(seed.section),
          fieldKey: seed.fieldKey,
          fieldLabel: getFieldLabel(seed.section, seed.fieldKey),
          sourceId: seed.sourceId,
          sourceText: seed.sourceText,
        });
      }

      const totalFields = allSeeds.length;
      const missingFields = Math.max(0, totalFields - completedFields);
      const completion = totalFields ? Math.round((completedFields / totalFields) * 100) : 0;
      const status: LocaleSummary["status"] =
        !existing?.active
          ? "pasif"
          : completedFields === 0
            ? "bekliyor"
            : completedFields >= totalFields
              ? "tam"
              : "kısmi";

      return {
        locale: language.code,
        name: language.label,
        nativeName: language.nativeLabel,
        direction: language.direction,
        active: Boolean(existing?.active),
        isDefault: normalizeLanguageCode(panel.seo.defaultLocale) === language.code,
        draftCount: localeDrafts.length,
        totalFields,
        completedFields,
        missingFields,
        completion,
        status,
        lastTranslationAt: translatedDrafts[0]?.updatedAt ?? translatedDrafts[0]?.createdAt ?? null,
        missingItems,
      };
    });
  }, [allSeeds, draftLookup, drafts, localeMap, panel.seo.defaultLocale]);

  const activeLocaleCount = localeSummaries.filter((item) => item.active).length;
  const defaultLocale = normalizeLanguageCode(panel.seo.defaultLocale);
  const totalDraftCount = drafts.length;
  const totalMissingCount = localeSummaries.reduce((sum, item) => sum + item.missingFields, 0);
  const selectedSummary =
    selectedLocale ? localeSummaries.find((item) => item.locale === selectedLocale) ?? null : null;
  const activeLocales = localeSummaries.filter((item) => item.active).map((item) => item.locale);

  async function sendAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/business/translations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await readResponseBody(response);
    const parsed = parseMaybeJson(rawText);

    if (!response.ok) {
      throw new Error(formatApiError(parsed, response.status));
    }

    return parsed;
  }

  async function updateLanguageState(languageCode: SupportedLanguageCode, active: boolean) {
    if (!active && defaultLocale === languageCode) {
      throw new Error("Varsayılan dil kapatılamaz.");
    }

    return sendAction({
      action: "toggle_language",
      languageCode,
      active,
    });
  }

  async function setDefaultLanguage(languageCode: SupportedLanguageCode) {
    return sendAction({
      action: "set_default_language",
      languageCode,
    });
  }

  async function translateLanguage(languageCode: SupportedLanguageCode) {
    return sendAction({
      action: "translate_language",
      languageCode,
    });
  }

  async function handleToggle(languageCode: SupportedLanguageCode) {
    const existing = localeMap.get(languageCode);
    const nextActive = !(existing?.active ?? false);

    setState({ status: "saving", message: `${getLanguageLabel(languageCode)} güncelleniyor...` });

    try {
      await updateLanguageState(languageCode, nextActive);
      if (nextActive) {
        await translateLanguage(languageCode);
      }

      setState({
        status: "success",
        message: nextActive
          ? `${getLanguageLabel(languageCode)} aktifleştirildi ve çeviri kuyruğu oluşturuldu.`
          : `${getLanguageLabel(languageCode)} pasife alındı.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Dil güncellenemedi.",
      });
    }
  }

  async function handleDefault(languageCode: SupportedLanguageCode) {
    setState({ status: "saving", message: `${getLanguageLabel(languageCode)} varsayılan yapılıyor...` });

    try {
      await setDefaultLanguage(languageCode);
      setState({ status: "success", message: "Varsayılan dil güncellendi." });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Varsayılan dil güncellenemedi.",
      });
    }
  }

  async function handleTranslate(languageCode: SupportedLanguageCode) {
    setState({ status: "saving", message: `${getLanguageLabel(languageCode)} için çeviri hazırlanıyor...` });

    try {
      await translateLanguage(languageCode);
      setState({
        status: "success",
        message: `${getLanguageLabel(languageCode)} için draft çeviriler oluşturuldu.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Çeviri oluşturulamadı.",
      });
    }
  }

  async function handleTranslateAllActive() {
    if (!activeLocales.length) {
      setState({ status: "error", message: "Aktif dil bulunamadı." });
      return;
    }

    setProgress({
      running: true,
      completed: 0,
      total: activeLocales.length,
      currentLocale: "",
    });
    setState({
      status: "saving",
      message: "Aktif diller için AI çeviri kuyruğu hazırlanıyor...",
    });

    try {
      for (let index = 0; index < activeLocales.length; index += 1) {
        const localeCode = activeLocales[index];
        setProgress({
          running: true,
          completed: index,
          total: activeLocales.length,
          currentLocale: getLanguageLabel(localeCode),
        });
        await translateLanguage(localeCode);
        setProgress({
          running: true,
          completed: index + 1,
          total: activeLocales.length,
          currentLocale: getLanguageLabel(localeCode),
        });
      }

      setState({
        status: "success",
        message: `${activeLocales.length} aktif dil için draft çeviriler oluşturuldu.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Toplu çeviri tamamlanamadı.",
      });
    } finally {
      setProgress({
        running: false,
        completed: 0,
        total: 0,
        currentLocale: "",
      });
    }
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Dil Yönetimi
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            AI çeviri kuyruğu ve dil operasyon merkezi
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Çeviriler draft olarak tutulur. Publish Center onaylamadan public siteye yansımaz.
          </p>
        </div>

        {state.message ? (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm",
              state.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : state.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700",
            ].join(" ")}
          >
            {state.message}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Aktif dil" value={`${activeLocaleCount}`} helper="Business admin için açık olan diller." />
          <Metric
            label="Varsayılan dil"
            value={defaultLocale ? getLanguageLabel(defaultLocale) : "-"}
            helper={defaultLocale ? defaultLocale.toUpperCase() : "Seçilmedi"}
          />
          <Metric label="Toplam draft" value={`${totalDraftCount}`} helper="BusinessId bazlı çeviri taslakları." />
          <Metric label="Eksik çeviri" value={`${totalMissingCount}`} helper="Tamamlanmamış alan sayısı." />
          <Metric
            label="AI durumu"
            value={aiEnabled ? "OpenAI bağlı" : "Placeholder"}
            helper={aiEnabled ? `Model: ${aiModel || "-"}` : "Env yoksa [EN] metin şeklinde çalışır."}
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || progress.running}
            onClick={() => {
              void handleTranslateAllActive();
            }}
            type="button"
          >
            Tüm aktif dilleri AI ile çevir
          </button>

          <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Toplu ilerleme
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {progress.running ? `${progress.completed}/${progress.total}` : "Hazır"}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-950 transition-all"
                style={{
                  width:
                    progress.running && progress.total
                      ? `${Math.max(6, Math.round((progress.completed / progress.total) * 100))}%`
                      : "0%",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {progress.running
                ? `Şu anda: ${progress.currentLocale || "Hazırlanıyor"}`
                : "Aktif diller sırayla işlenir."}
            </p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Dil tablosu</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Aktif/pasif durum, varsayılan dil, çeviri tamamlanma oranı ve eksik alanlar tek ekranda.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] border-separate border-spacing-0">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <Th>Dil adı</Th>
                <Th>Kod</Th>
                <Th>Aktif</Th>
                <Th>Varsayılan</Th>
                <Th>Çeviri durumu</Th>
                <Th>Yüzde</Th>
                <Th>Eksik alan</Th>
                <Th>Son çeviri zamanı</Th>
                <Th className="text-right">Aksiyonlar</Th>
              </tr>
            </thead>
            <tbody>
              {localeSummaries.map((summary) => {
                return (
                  <tr
                    key={summary.locale}
                    className={[
                      "border-t border-slate-100",
                      selectedLocale === summary.locale ? "bg-slate-50/70" : "",
                    ].join(" ")}
                  >
                    <Td>
                      <div className="grid gap-1 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-slate-950">{summary.name}</div>
                          {summary.direction === "rtl" ? (
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                              RTL
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">{summary.nativeName}</div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <code className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {summary.locale}
                        </code>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                          {summary.direction}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <ToggleBadge active={summary.active} label={summary.active ? "Aktif" : "Pasif"} />
                    </Td>
                    <Td>
                      <ToggleBadge
                        active={summary.isDefault}
                        label={summary.isDefault ? "Varsayılan" : "-"}
                      />
                    </Td>
                    <Td>
                      <StatusBadge summary={summary} />
                    </Td>
                    <Td>
                      <span className="text-sm font-semibold text-slate-900">
                        {summary.completion}%
                      </span>
                    </Td>
                    <Td>
                      <div className="grid gap-1">
                        <span className="text-sm font-semibold text-slate-900">
                          {summary.missingFields}
                        </span>
                        <span className="text-xs text-slate-500">alan</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="grid gap-1 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {formatDateTime(summary.lastTranslationAt)}
                        </span>
                        <span className="text-xs text-slate-500">{summary.draftCount} draft</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2 py-3">
                        <ActionButton
                          disabled={isPending || progress.running || summary.isDefault}
                          tone={summary.active ? "secondary" : "primary"}
                          onClick={() => {
                            void handleToggle(summary.locale);
                          }}
                        >
                          {summary.active ? "Pasifleştir" : "Aktifleştir"}
                        </ActionButton>

                        <ActionButton
                          disabled={isPending || progress.running || summary.isDefault}
                          tone="secondary"
                          onClick={() => {
                            void handleDefault(summary.locale);
                          }}
                        >
                          Varsayılan yap
                        </ActionButton>

                        <ActionButton
                          disabled={isPending || progress.running}
                          tone="secondary"
                          onClick={() => {
                            void handleTranslate(summary.locale);
                          }}
                        >
                          {summary.draftCount > 0 ? "Yeniden çevir" : "AI ile çevir"}
                        </ActionButton>

                        <ActionButton
                          disabled={progress.running}
                          tone={selectedLocale === summary.locale ? "primary" : "secondary"}
                          onClick={() => {
                            setSelectedLocale((current) =>
                              current === summary.locale ? null : summary.locale,
                            );
                          }}
                        >
                          {selectedLocale === summary.locale ? "Eksikleri gizle" : "Eksikleri göster"}
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSummary ? (
        <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Eksik çeviri detayı
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {selectedSummary.name} / {selectedSummary.locale.toUpperCase()}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {selectedSummary.direction === "rtl"
                  ? "Bu dil RTL olarak işaretlidir. Public site ve preview katmanında yön desteği hazır."
                  : "Seçili dil için eksik alanlar aşağıda listeleniyor. AI çeviri bu alanları draft olarak doldurur."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToggleBadge active={selectedSummary.active} label={selectedSummary.active ? "Aktif dil" : "Pasif dil"} />
              <ToggleBadge
                active={selectedSummary.isDefault}
                label={selectedSummary.isDefault ? "Varsayılan dil" : "Varsayılan değil"}
              />
              {selectedSummary.direction === "rtl" ? (
                <ToggleBadge active label="RTL destekli" />
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="Toplam alan" value={`${selectedSummary.totalFields}`} />
            <MiniStat label="Tamamlanan" value={`${selectedSummary.completedFields}`} />
            <MiniStat label="Eksik" value={`${selectedSummary.missingFields}`} />
            <MiniStat label="Son çeviri" value={formatDateTime(selectedSummary.lastTranslationAt)} />
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Eksik alanlar
            </div>
            {selectedSummary.missingItems.length ? (
              <div className="grid gap-3">
                {selectedSummary.missingItems.map((item) => (
                  <div
                    key={makeSeedKey(selectedSummary.locale, item.section, item.sourceId, item.fieldKey)}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {item.sectionLabel} · {item.fieldLabel}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {item.section} / {item.sourceId}
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {item.fieldKey}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Kaynak metin: {item.sourceText || "-"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Bu dil için eksik alan yok.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <div className="font-semibold text-slate-950">BusinessId izolasyonu</div>
        <p>{businessId}</p>
        <p className="text-xs leading-6 text-slate-500">
          Çeviriler yalnızca bu business içinde draft olarak saklanır; public siteye Publish Center ile
          aktarılır.
        </p>
      </section>
    </section>
  );
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ToggleBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function StatusBadge({ summary }: { summary: LocaleSummary }) {
  const tone =
    summary.status === "tam"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : summary.status === "kısmi"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : summary.status === "pasif"
          ? "border-slate-200 bg-slate-50 text-slate-500"
          : "border-sky-200 bg-sky-50 text-sky-700";

  const label =
    summary.status === "tam"
      ? "Tamamlandı"
      : summary.status === "kısmi"
        ? "Kısmi"
        : summary.status === "pasif"
          ? "Pasif"
          : "Bekliyor";

  return (
    <div className="grid gap-2">
      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
        {label}
      </span>
      <div className="text-xs text-slate-500">
        {summary.direction === "rtl" ? "RTL hazır" : "LTR"} · {summary.totalFields} alan
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 align-middle font-semibold ${className}`}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="border-t border-slate-100 px-4 align-middle">{children}</td>;
}

function ActionButton({
  children,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary";
}) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-10 items-center justify-center rounded-2xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "secondary"
          ? "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
          : "bg-slate-950 text-white hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
