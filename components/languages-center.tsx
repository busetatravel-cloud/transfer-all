"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BusinessPanelData, BusinessLocaleRecord } from "@/lib/business-panel";
import {
  getLanguageLabel,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
  type SupportedLanguageCode,
} from "@/lib/languages";

type LanguagesCenterProps = {
  businessId: string;
  panel: BusinessPanelData;
  drafts: TranslationDraftRecord[];
};

type ActionState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type LocaleSummary = {
  locale: SupportedLanguageCode;
  draftCount: number;
  totalFields: number;
  completedFields: number;
  missingFields: number;
  completion: number;
  status: string;
};

type TranslationDraftRecord = {
  id: string;
  businessId: string;
  localeCode: string;
  section: string;
  sourceId: string;
  fieldKey: string;
  sourceText: string;
  translatedText: string;
  createdAt: string;
  updatedAt: string;
};

const TRANSLATION_TARGETS = {
  company: ["name"],
  hero: ["heroTitle", "heroSubtitle", "heroButtonText"],
  service: ["title", "description"],
  vehicle: ["title", "description"],
  route: ["title", "description"],
  blog: ["title", "excerpt", "content"],
  seo: ["metaTitle", "metaDescription"],
  menus: ["home", "services", "vehicles", "routes", "blogLabel", "contact", "quote", "booking", "languages"],
  publicForm: ["title", "description", "customerName", "phone", "email", "message", "submit", "sending", "success", "error"],
  voucher: [
    "mailSubject",
    "mailGreeting",
    "mailReservationNo",
    "mailDateTime",
    "mailPhone",
    "mailOrigin",
    "mailDestination",
    "mailVoucherLink",
    "mailClosing",
    "whatsappGreeting",
    "whatsappReady",
    "whatsappReservationNo",
    "whatsappDateTime",
    "whatsappOriginDestination",
    "whatsappVoucher",
  ],
  booking: [
    "eyebrow",
    "title",
    "description",
    "searchPlaceholder",
    "searchButton",
    "openVoucher",
    "statusLabel",
    "paymentLabel",
    "dateLabel",
    "timeLabel",
    "originLabel",
    "destinationLabel",
    "vehicleLabel",
    "pickupLabel",
    "passengersLabel",
    "notesLabel",
    "waitingTitle",
    "waitingDescription",
    "noResultTitle",
    "noResultDescription",
    "reservationLabel",
  ],
} as const;

const SECTION_TOTALS = {
  menus: TRANSLATION_TARGETS.menus.length,
  publicForm: TRANSLATION_TARGETS.publicForm.length,
  voucher: TRANSLATION_TARGETS.voucher.length,
  booking: TRANSLATION_TARGETS.booking.length,
};

export function LanguagesCenter({ businessId, panel, drafts }: LanguagesCenterProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ status: "idle", message: "" });
  const [isPending, startTransition] = useTransition();

  const localeMap = useMemo(() => {
    const map = new Map<string, BusinessLocaleRecord>();
    for (const locale of panel.locales) {
      map.set(locale.code.toLowerCase(), locale);
    }
    return map;
  }, [panel.locales]);

  const localeSummaries = useMemo(() => {
    const draftLookup = new Map<string, TranslationDraftRecord>();
    for (const draft of drafts) {
      draftLookup.set(`${draft.localeCode}:${draft.section}:${draft.sourceId}:${draft.fieldKey}`, draft);
    }

    const dynamicTotals =
      1 +
      3 +
      panel.services.length * 2 +
      panel.vehicles.length * 2 +
      panel.routes.length * 2 +
      panel.blogs.length * 3 +
      2;
    const totalFields =
      dynamicTotals +
      SECTION_TOTALS.menus +
      SECTION_TOTALS.publicForm +
      SECTION_TOTALS.voucher +
      SECTION_TOTALS.booking;

    const seedKeys = [
      ...TRANSLATION_TARGETS.company.map((fieldKey) => ({ section: "company", sourceId: "business", fieldKey })),
      ...TRANSLATION_TARGETS.hero.map((fieldKey) => ({ section: "hero", sourceId: "profile", fieldKey })),
      ...panel.services.flatMap((item) =>
        TRANSLATION_TARGETS.service.map((fieldKey) => ({ section: "service", sourceId: item.id, fieldKey })),
      ),
      ...panel.vehicles.flatMap((item) =>
        TRANSLATION_TARGETS.vehicle.map((fieldKey) => ({ section: "vehicle", sourceId: item.id, fieldKey })),
      ),
      ...panel.routes.flatMap((item) =>
        TRANSLATION_TARGETS.route.map((fieldKey) => ({ section: "route", sourceId: item.id, fieldKey })),
      ),
      ...panel.blogs.flatMap((item) =>
        TRANSLATION_TARGETS.blog.map((fieldKey) => ({ section: "blog", sourceId: item.id, fieldKey })),
      ),
      ...TRANSLATION_TARGETS.seo.map((fieldKey) => ({ section: "seo", sourceId: "seo", fieldKey })),
      ...TRANSLATION_TARGETS.menus.map((fieldKey) => ({ section: "menus", sourceId: "main", fieldKey })),
      ...TRANSLATION_TARGETS.publicForm.map((fieldKey) => ({
        section: "publicForm",
        sourceId: "contact-form",
        fieldKey,
      })),
      ...TRANSLATION_TARGETS.voucher.map((fieldKey) => ({
        section: "voucher",
        sourceId: fieldKey.startsWith("whatsapp") ? "whatsapp" : "mail",
        fieldKey,
      })),
      ...TRANSLATION_TARGETS.booking.map((fieldKey) => ({
        section: "booking",
        sourceId:
          fieldKey === "eyebrow" ||
          fieldKey === "title" ||
          fieldKey === "description" ||
          fieldKey === "searchPlaceholder" ||
          fieldKey === "searchButton"
            ? "search"
            : fieldKey === "openVoucher" ||
                fieldKey === "statusLabel" ||
                fieldKey === "paymentLabel" ||
                fieldKey === "dateLabel" ||
                fieldKey === "timeLabel" ||
                fieldKey === "originLabel" ||
                fieldKey === "destinationLabel" ||
                fieldKey === "vehicleLabel" ||
                fieldKey === "pickupLabel" ||
                fieldKey === "passengersLabel" ||
                fieldKey === "notesLabel"
              ? "result"
              : "empty",
        fieldKey,
      })),
    ];

    return SUPPORTED_LANGUAGES.map<LocaleSummary>((language) => {
      const completedFields = seedKeys.reduce((count, seed) => {
        const current = draftLookup.get(
          `${language.code}:${seed.section}:${seed.sourceId}:${seed.fieldKey}`,
        );
        return count + (current?.translatedText.trim() ? 1 : 0);
      }, 0);
      const missingFields = Math.max(0, totalFields - completedFields);
      const completion = totalFields ? Math.round((completedFields / totalFields) * 100) : 0;
      const status =
        completedFields === 0
          ? "Boş"
          : completedFields >= totalFields
            ? "Tam"
            : "Kısmi";

      return {
        locale: language.code,
        draftCount: drafts.filter((draft) => draft.localeCode === language.code).length,
        totalFields,
        completedFields,
        missingFields,
        completion,
        status,
      };
    });
  }, [drafts, panel]);

  async function sendJson(path: string, payload: Record<string, unknown>, method = "POST") {
    const response = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text().catch(() => "");
    let parsed: { ok?: boolean; message?: string; code?: string } | null = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw) as { ok?: boolean; message?: string; code?: string };
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      throw new Error(parsed?.message || parsed?.code || "İşlem başarısız.");
    }

    return parsed;
  }

  async function updateLocale(
    languageCode: SupportedLanguageCode,
    nextActive: boolean,
  ) {
    if (!nextActive && panel.seo.defaultLocale?.toLowerCase() === languageCode) {
      throw new Error("Varsayılan dil kapatılamaz.");
    }

    await sendJson(
      "/api/business/translations",
      {
        action: "toggle_language",
        languageCode,
        active: nextActive,
      },
      "PATCH",
    );
  }

  async function updateDefaultLocale(languageCode: SupportedLanguageCode) {
    await sendJson(
      "/api/business/translations",
      {
        action: "set_default_language",
        languageCode,
      },
      "PATCH",
    );
  }

  async function runTranslation(localeCode: SupportedLanguageCode) {
    await sendJson(
      "/api/business/translations",
      {
        action: "translate_language",
        languageCode: localeCode,
      },
      "PATCH",
    );
  }

  async function toggleLocale(languageCode: SupportedLanguageCode) {
    const existing = localeMap.get(languageCode);
    const nextActive = !(existing?.active ?? false);
    setState({ status: "saving", message: "Dil güncelleniyor..." });

    try {
      await updateLocale(languageCode, nextActive);
      if (nextActive) {
        await runTranslation(languageCode);
      }
      setState({
        status: "success",
        message: nextActive ? "Dil aktifleştirildi ve çeviri kuyruğu oluşturuldu." : "Dil pasife alındı.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Dil kaydı güncellenemedi.",
      });
    }
  }

  async function makeDefaultLocale(languageCode: SupportedLanguageCode) {
    setState({ status: "saving", message: "Varsayılan dil kaydediliyor..." });

    try {
      await updateDefaultLocale(languageCode);
      setState({ status: "success", message: "Varsayılan dil güncellendi." });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Varsayılan dil kaydedilemedi.",
      });
    }
  }

  async function translateAllActiveLocales() {
    setState({ status: "saving", message: "Aktif diller için AI çeviri kuyruğu hazırlanıyor..." });

    try {
      await sendJson(
        "/api/business/translations",
        {
          action: "translate_all_active",
        },
        "PATCH",
      );
      setState({
        status: "success",
        message: "Tüm aktif diller için çeviri taslakları oluşturuldu.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Toplu çeviri oluşturulamadı.",
      });
    }
  }

  const activeLocaleCount = panel.locales.filter((item) => item.active).length;
  const defaultLocale = normalizeLanguageCode(panel.seo.defaultLocale);

  return (
    <section className="grid gap-6">
      <header className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Dil Yönetimi
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Desteklenen diller, aktif durum ve AI çeviri kuyruğu
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Çeviriler draft olarak kaydedilir. Yayın Merkezi onaylamadan public siteye yansımaz.
          </p>
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Metric label="Aktif dil" value={`${activeLocaleCount}`} />
          <Metric label="Varsayılan" value={defaultLocale || "-"} />
          <Metric label="Toplam draft" value={`${drafts.length}`} />
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void translateAllActiveLocales();
              });
            }}
            type="button"
          >
            Tüm aktif dilleri AI ile çevir
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Desteklenen dil listesi
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Business admin sadece aktif dilleri kullanır, varsayılan dil tekildir ve kapatılamaz.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <Th>Başlık</Th>
                <Th>Kod</Th>
                <Th>Aktif</Th>
                <Th>Varsayılan</Th>
                <Th>Çeviri durumu</Th>
                <Th>Yüzde</Th>
                <Th>Eksik</Th>
                <Th className="text-right">Aksiyon</Th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_LANGUAGES.map((language) => {
                const existing = localeMap.get(language.code);
                const summary = localeSummaries.find((item) => item.locale === language.code);
                const isDefault = defaultLocale === language.code;
                const isActive = Boolean(existing?.active);

                return (
                  <tr key={language.code} className="border-t border-slate-100">
                    <Td>
                      <div className="grid gap-1 py-4">
                        <div className="font-semibold text-slate-950">{language.label}</div>
                        <div className="text-xs text-slate-500">{language.nativeLabel}</div>
                      </div>
                    </Td>
                    <Td>
                      <code className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {language.code}
                      </code>
                    </Td>
                    <Td>
                      <ToggleBadge active={isActive} label={isActive ? "Aktif" : "Pasif"} />
                    </Td>
                    <Td>
                      <ToggleBadge active={isDefault} label={isDefault ? "Varsayılan" : "-"} />
                    </Td>
                    <Td>
                      <span className="text-sm font-medium text-slate-700">
                        {summary?.status ?? "-"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm font-medium text-slate-700">
                        {summary ? `${summary.completion}%` : "0%"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm font-medium text-slate-700">
                        {summary?.missingFields ?? 0}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2 py-3">
                        <button
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(() => {
                              void toggleLocale(language.code);
                            });
                          }}
                          type="button"
                        >
                          {isActive ? "Pasifleştir" : "Aktifleştir"}
                        </button>
                        <button
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
                          disabled={isPending || isDefault}
                          onClick={() => {
                            startTransition(() => {
                              void makeDefaultLocale(language.code);
                            });
                          }}
                          type="button"
                        >
                          Varsayılan yap
                        </button>
                        <button
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-50"
                          disabled={isPending || !isActive}
                          onClick={() => {
                            startTransition(() => {
                              setState({
                                status: "saving",
                                message: `${getLanguageLabel(language.code)} için çeviri hazırlanıyor...`,
                              });
                              void runTranslation(language.code)
                                .then(() => {
                                  setState({
                                    status: "success",
                                    message: `${getLanguageLabel(language.code)} için çeviri kuyruğu oluşturuldu.`,
                                  });
                                  router.refresh();
                                })
                                .catch((error) => {
                                  setState({
                                    status: "error",
                                    message:
                                      error instanceof Error
                                        ? error.message
                                        : "Çeviri kuyruğu oluşturulamadı.",
                                  });
                                });
                            });
                          }}
                          type="button"
                        >
                          AI ile çevir
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <div className="font-semibold text-slate-950">BusinessId izolasyonu</div>
        <p>{businessId}</p>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
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

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 align-middle font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="border-t border-slate-100 px-4 align-middle">{children}</td>;
}
