/* eslint-disable @next/next/no-img-element */

"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import type { BusinessPanelData } from "@/lib/business-panel";
import {
  PAYMENT_STATUS_OPTIONS,
  formatPaymentStatusLabel,
} from "@/lib/request-statuses";

type Props = {
  panel: BusinessPanelData;
  module?:
    | "dashboard"
    | "company"
    | "domain"
    | "media"
    | "services"
    | "vehicles"
    | "routes"
    | "blog"
    | "seo"
    | "languages"
    | "reservations"
    | "operation"
    | "finance"
    | "customers"
    | "password";
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

type CollectionItem = {
  id: string;
  title?: string;
  description?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  code?: string;
  name?: string;
  active?: boolean;
  published?: boolean;
  translationComplete?: boolean;
};

type CollectionSection = "service" | "vehicle" | "route" | "blog" | "locale";

type PreviewViewport = "desktop" | "tablet" | "phone";

type MediaSlotKey =
  | "logo"
  | "hero"
  | "service_cover"
  | "vehicle_cover"
  | "vehicle_interior"
  | "vehicle_exterior"
  | "vehicle_trunk"
  | "vehicle_seat"
  | "route_cover"
  | "blog_cover";

const MEDIA_SLOT_FIELDS: Array<{
  kind: MediaSlotKey;
  label: string;
  description: string;
}> = [
  { kind: "logo", label: "Logo", description: "Marka logosu ve kurumsal kimlik." },
  { kind: "hero", label: "Hero", description: "Ana sayfa kapak görseli." },
  { kind: "service_cover", label: "Hizmet", description: "Hizmet kapak görseli." },
  { kind: "vehicle_cover", label: "Araç kapak", description: "Araç listesi için kapak." },
  { kind: "vehicle_interior", label: "İç görünüm", description: "Araç iç fotoğrafı." },
  { kind: "vehicle_exterior", label: "Dış görünüm", description: "Araç dış fotoğrafı." },
  { kind: "vehicle_trunk", label: "Bagaj", description: "Bagaj fotoğrafı." },
  { kind: "vehicle_seat", label: "Koltuk", description: "Koltuk düzeni." },
  { kind: "route_cover", label: "Rota", description: "Rota kapak görseli." },
  { kind: "blog_cover", label: "Blog", description: "Blog kapak görseli." },
];

const BOOKING_STATUS_OPTIONS = [
  "Bekliyor",
  "Onaylandı",
  "Şoför Atandı",
  "Tamamlandı",
  "İptal",
] as const;

const OPERATION_STATUS_OPTIONS = ["Onaylandı", "Şoför Atandı"] as const;

function formatPanelBookingStatusLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "Bekliyor";
  }

  if (
    BOOKING_STATUS_OPTIONS.includes(
      normalized as (typeof BOOKING_STATUS_OPTIONS)[number],
    )
  ) {
    return normalized;
  }

  const map: Record<string, string> = {
    new: "Bekliyor",
    in_progress: "Şoför Atandı",
    completed: "Tamamlandı",
    archived: "İptal",
  };

  return map[normalized.toLowerCase()] ?? "Bekliyor";
}

type OperationFilter = "today" | "tomorrow" | "week" | "future";

type OperationView = BusinessPanelData["requests"][number];

function formatPanelErrorDetailed(
  body:
    | {
        error?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
        code?: string;
      }
    | null,
) {
  if (!body) {
    return "Kaydetme basarisiz.";
  }

  const code = body.code ? ` [${body.code}]` : "";
  const fieldErrors = body.fieldErrors
    ? `\n${JSON.stringify(body.fieldErrors, null, 2)}`
    : "";

  if (body.error === "validation_error") {
    const labels = Object.keys(body.fieldErrors ?? {})
      .map((key) => RESERVATION_FIELD_LABELS[key] ?? key)
      .filter(Boolean);
    const suffix = labels.length ? `: ${labels.join(", ")}` : "";
    return `${body.message ?? "Lutfen zorunlu alanlari doldurun."}${code}${suffix}${fieldErrors}`;
  }

  return `${body.message ?? body.error ?? "Kaydetme basarisiz."}${code}${fieldErrors}`;
}

async function readErrorResponse(response: Response) {
  const rawText = await response.text().catch(() => "");

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as
      | {
          error?: string;
          message?: string;
          fieldErrors?: Record<string, string>;
          code?: string;
          stack?: string | null;
        }
      | string;
  } catch {
    return rawText;
  }
}

const RESERVATION_FIELD_LABELS: Record<string, string> = {
  customerName: "Müşteri adı",
  origin: "Nereden",
  destination: "Nereye",
  travelDate: "Tarih",
  travelTime: "Saat",
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function compareOperations(left: OperationView, right: OperationView) {
  const leftDate = `${left.travelDate ?? ""} ${left.travelTime ?? ""}`;
  const rightDate = `${right.travelDate ?? ""} ${right.travelTime ?? ""}`;
  return leftDate.localeCompare(rightDate) || right.createdAt.localeCompare(left.createdAt);
}

function filterOperations(
  operations: OperationView[],
  filter: OperationFilter,
  todayKey: string,
) {
  const tomorrowKey = toDateKey(addDays(new Date(), 1));
  const weekEnd = addDays(new Date(), 6);
  const weekEndKey = toDateKey(weekEnd);

  return operations.filter((operation) => {
    const dateKey = operation.travelDate?.trim() ?? "";

    if (!dateKey) {
      return false;
    }

    if (filter === "today") {
      return dateKey === todayKey;
    }

    if (filter === "tomorrow") {
      return dateKey === tomorrowKey;
    }

    if (filter === "week") {
      return dateKey >= todayKey && dateKey <= weekEndKey;
    }

    return dateKey > weekEndKey;
  });
}

function buildOperationSummary(operations: OperationView[], todayKey: string) {
  const todayOperations = operations.filter((item) => item.travelDate?.trim() === todayKey);
  return {
    today: todayOperations.length,
    assigned: todayOperations.filter((item) => item.assignedVehicle || item.driverName).length,
    waiting: todayOperations.filter(
      (item) => formatPanelBookingStatusLabel(item.bookingStatus) === BOOKING_STATUS_OPTIONS[0],
    ).length,
    completed: todayOperations.filter(
      (item) => formatPanelBookingStatusLabel(item.bookingStatus) === BOOKING_STATUS_OPTIONS[3],
    ).length,
  };
}

type CustomerView = BusinessPanelData["customers"][number] & {
  reservationCount: number;
  totalSpend: number;
  history: Array<{
    id: string;
    label: string;
    amount: number;
    status: string;
  }>;
};

function normalizeContact(value: string | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe ? safe.toLowerCase() : "";
}

function buildCustomerViews(panel: BusinessPanelData) {
  return panel.customers.map((customer) => {
    const emailKey = normalizeContact(customer.email);
    const phoneKey = normalizeContact(customer.phone);
    const matchedRequests = panel.requests.filter((request) => {
      const requestEmail = normalizeContact(request.email);
      const requestPhone = normalizeContact(request.phone);

      return (
        (emailKey && requestEmail && requestEmail === emailKey) ||
        (phoneKey && requestPhone && requestPhone === phoneKey)
      );
    });

    const history = matchedRequests.map((request) => ({
      id: request.id,
      label: `${request.travelDate ?? "-"} ${request.origin ?? "-"} → ${request.destination ?? "-"}`,
      amount: Number(request.totalAmount ?? 0),
      status: formatPanelBookingStatusLabel(request.bookingStatus),
    }));

    return {
      ...customer,
      reservationCount: matchedRequests.length,
      totalSpend: matchedRequests.reduce(
        (total, request) => total + Number(request.totalAmount ?? 0),
        0,
      ),
      history,
    } satisfies CustomerView;
  });
}

type FinanceSummary = {
  totalTurnover: number;
  depositCollected: number;
  remainingCollection: number;
  collectedInVehicle: number;
  paidTotal: number;
  refundTotal: number;
  totalProfit: number;
  totalSupplierPass: number;
  totalAgencyPass: number;
  vehicleCollection: number;
};

function toMoney(value: number | null | undefined) {
  return Number.isFinite(Number(value ?? 0)) ? Number(value ?? 0) : 0;
}

function formatMoneyValue(value: number, currency?: string | null) {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  const safeCurrency = String(currency ?? "").trim();
  return safeCurrency ? `${formatted} ${safeCurrency}` : formatted;
}

function formatFinanceSummaryValue(value: number, currency?: string | null) {
  return formatMoneyValue(value, currency);
}

function financeCellText(value: number | null | undefined, currency?: string | null) {
  return formatMoneyValue(toMoney(value), currency);
}

function normalizeFilterValue(value: string) {
  const safe = String(value ?? "").trim();
  return safe && safe !== "all" ? safe : "";
}

function buildFinanceSummaryCurrency(operations: OperationView[]) {
  const currencies = Array.from(
    new Set(
      operations
        .map((request) => String(request.currency ?? "").trim())
        .filter(Boolean),
    ),
  );

  return currencies.length === 1 ? currencies[0] : null;
}

function buildFinanceSummary(operations: OperationView[]) {
  const depositCollectedStatus = PAYMENT_STATUS_OPTIONS[1];
  const paidStatus = PAYMENT_STATUS_OPTIONS[2];
  const vehicleStatus = PAYMENT_STATUS_OPTIONS[3];
  const openBalanceStatuses = new Set<string>([
    PAYMENT_STATUS_OPTIONS[0],
    PAYMENT_STATUS_OPTIONS[1],
  ]);
  const refundStatuses = new Set<string>([PAYMENT_STATUS_OPTIONS[4], PAYMENT_STATUS_OPTIONS[5]]);

  return operations.reduce<FinanceSummary>(
    (summary, request) => {
      const total = toMoney(request.totalAmount);
      const deposit = toMoney(request.depositAmount);
      const remaining = toMoney(request.remainingAmount);
      const collectedAmount = toMoney(request.collectedAmount);
      const supplierPass = toMoney(request.supplierPass);
      const agencyPass = toMoney(request.agencyPass);
      const profit = toMoney(request.profit ?? collectedAmount + agencyPass - supplierPass);
      const paymentStatus = formatPaymentStatusLabel(request.paymentStatus);

      summary.totalTurnover += total;
      summary.totalProfit += profit;
      summary.totalSupplierPass += supplierPass;
      summary.totalAgencyPass += agencyPass;

      if (paymentStatus === depositCollectedStatus) {
        summary.depositCollected += deposit || total;
      }

      if (openBalanceStatuses.has(paymentStatus)) {
        summary.remainingCollection += remaining || Math.max(total - deposit, 0);
      }

      if (paymentStatus === paidStatus) {
        summary.paidTotal += total;
      }

      if (paymentStatus === vehicleStatus) {
        summary.collectedInVehicle += remaining || total;
      }

      if (refundStatuses.has(paymentStatus)) {
        summary.refundTotal += total;
      }

      summary.vehicleCollection += remaining || Math.max(total - deposit, 0);

      return summary;
    },
    {
      totalTurnover: 0,
      depositCollected: 0,
      remainingCollection: 0,
      collectedInVehicle: 0,
      paidTotal: 0,
      refundTotal: 0,
      totalProfit: 0,
      totalSupplierPass: 0,
      totalAgencyPass: 0,
      vehicleCollection: 0,
    },
  );
}

export function BusinessPanelEditor({ panel, module = "dashboard" }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();
  const [previewViewport, setPreviewViewport] =
    useState<PreviewViewport>("desktop");
  const [operationFilter, setOperationFilter] =
    useState<OperationFilter>("today");
  const [financeDateFilter, setFinanceDateFilter] = useState("");
  const [financePaymentFilter, setFinancePaymentFilter] = useState("all");
  const [financeCurrencyFilter, setFinanceCurrencyFilter] = useState("all");
  const [financeSourceFilter, setFinanceSourceFilter] = useState("all");
  const [financeQuery, setFinanceQuery] = useState("");
  const previewUrl = panel.business?.domain ? `https://${panel.business.domain}` : null;
  const todayKey = toDateKey(new Date());
  const operations = panel.requests.slice().sort(compareOperations);
  const operationCandidates = operations.filter((request) =>
    OPERATION_STATUS_OPTIONS.includes(formatPanelBookingStatusLabel(request.bookingStatus) as
      | "Onaylandı"
      | "Şoför Atandı"),
  );
  const filteredOperations = filterOperations(
    operationCandidates,
    operationFilter,
    todayKey,
  );
  const operationSummary = buildOperationSummary(operationCandidates, todayKey);
  const customerViews = buildCustomerViews(panel).sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt),
  );
  const financeFilterOptions = (() => {
    const sources = new Set<string>();
    const currencies = new Set<string>();

    for (const request of operations) {
      const source = String(request.source ?? "").trim();
      const currency = String(request.currency ?? "").trim();

      if (source) {
        sources.add(source);
      }

      if (currency) {
        currencies.add(currency);
      }
    }

    return {
      sources: Array.from(sources).sort((left, right) => left.localeCompare(right)),
      currencies: Array.from(currencies).sort((left, right) => left.localeCompare(right)),
    };
  })();
  const financeRows = (() => {
    const query = financeQuery.trim().toLowerCase();
    const selectedDate = financeDateFilter.trim();
    const selectedPayment = normalizeFilterValue(financePaymentFilter);
    const selectedCurrency = normalizeFilterValue(financeCurrencyFilter);
    const selectedSource = normalizeFilterValue(financeSourceFilter);

    return operations.filter((request) => {
      const date = String(request.travelDate ?? "").trim();
      const paymentStatus = formatPaymentStatusLabel(request.paymentStatus);
      const currency = String(request.currency ?? "").trim();
      const source = String(request.source ?? "").trim();
      const customer = String(request.customerName ?? "").trim().toLowerCase();
      const route = [request.origin, request.destination]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const phone = String(request.phone ?? "").trim().toLowerCase();
      const flight = String(request.flightCode ?? "").trim().toLowerCase();

      if (selectedDate && date !== selectedDate) {
        return false;
      }

      if (selectedPayment && paymentStatus !== selectedPayment) {
        return false;
      }

      if (selectedCurrency && currency !== selectedCurrency) {
        return false;
      }

      if (selectedSource && source !== selectedSource) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [customer, phone, route, flight].some((value) => value.includes(query));
    });
  })();
  const financeSummary = buildFinanceSummary(financeRows);
  const financeSummaryCurrency = buildFinanceSummaryCurrency(financeRows);
  const show = (...modules: Array<NonNullable<Props["module"]>>) =>
    module === "dashboard" ? true : modules.includes(module);

  async function sendPayload(
    payload: Record<string, string | boolean | number | undefined>,
    successMessage: string,
  ) {
    setState({ status: "saving", message: "Kaydediliyor..." });

    try {
      const response = await fetch("/api/business/panel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await readErrorResponse(response);

        setState({
          status: "error",
          message:
            typeof body === "string"
              ? body
              : formatPanelErrorDetailed(
                  body as
                    | {
                        error?: string;
                        message?: string;
                        fieldErrors?: Record<string, string>;
                        code?: string;
                      }
                    | null,
                ),
        });
        return false;
      }
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Baglanti kurulamadi. Lutfen tekrar deneyin.",
      });
      return false;
    }

    setState({
      status: "saved",
      message: successMessage,
    });

    startTransition(() => {
      router.refresh();
    });

    return true;
  }

  async function uploadMediaAsset(formData: FormData, successMessage: string) {
    setState({ status: "saving", message: "Yükleniyor..." });

    try {
      const response = await fetch("/api/business/media/upload", {
        method: "POST",
        body: formData,
      });

      const body = await readErrorResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof body === "string"
              ? body
              : formatPanelErrorDetailed(
                  body as
                    | {
                        error?: string;
                        message?: string;
                        fieldErrors?: Record<string, string>;
                        code?: string;
                      }
                    | null,
                ),
        });
        return false;
      }
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Baglanti kurulamadi. Lutfen tekrar deneyin.",
      });
      return false;
    }

    setState({
      status: "saved",
      message: successMessage,
    });

    startTransition(() => {
      router.refresh();
    });

    return true;
  }

  async function updateReservationQuick(
    reservationId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setState({ status: "saving", message: "Kaydediliyor..." });

    try {
      const response = await fetch(`/api/business/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "update",
          section: "reservation",
          payload,
        }),
      });

      const body = await readErrorResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof body === "string"
              ? body
              : formatPanelErrorDetailed(
                  body as
                    | {
                        error?: string;
                        message?: string;
                        fieldErrors?: Record<string, string>;
                        code?: string;
                      }
                    | null,
                ),
        });
        return false;
      }
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Baglanti kurulamadi. Lutfen tekrar deneyin.",
      });
      return false;
    }

    setState({
      status: "saved",
      message: successMessage,
    });

    startTransition(() => {
      router.refresh();
    });

    return true;
  }

  async function exportFinanceCsv() {
    setState({ status: "saving", message: "CSV hazırlanıyor..." });

    try {
      const response = await fetch("/api/business/export?type=finance", {
        headers: {
          Accept: "application/json",
        },
      });

      const body = await readErrorResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof body === "string"
              ? body
              : formatPanelErrorDetailed(
                  body as
                    | {
                        error?: string;
                        message?: string;
                        fieldErrors?: Record<string, string>;
                        code?: string;
                      }
                    | null,
                ),
        });
        return false;
      }

      const csv = typeof body === "object" && body && "preview" in body
        ? String((body as { preview?: { csv?: string } }).preview?.csv ?? "")
        : "";

      if (!csv.trim()) {
        throw new Error("CSV önizlemesi alınamadı.");
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `finance-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setState({
        status: "saved",
        message: "CSV export hazırlandı.",
      });
      return true;
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "CSV export hazırlanamadı.",
      });
      return false;
    }
  }

  function printFinanceTable() {
    window.print();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    await sendPayload(body as Record<string, string>, "Kaydedildi.");
  }

  async function deleteRecord(section: CollectionSection, recordId: string) {
    const confirmed = window.confirm("Bu kayit silinecek. Devam etmek istiyor musunuz?");

    if (!confirmed) {
      return;
    }

    await sendPayload(
      {
        section,
        action: "delete",
        recordId,
      },
      "Silindi.",
    );
  }

  function openPreview() {
    if (!previewUrl) {
      setState({
        status: "error",
        message: "Onizleme icin domain gerekli.",
      });
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  function previewWidthClass() {
    if (previewViewport === "tablet") {
      return "max-w-[820px]";
    }

    if (previewViewport === "phone") {
      return "max-w-[390px]";
    }

    return "max-w-none";
  }

  return (
    <section className="grid gap-6">
      <Notice state={state} pending={isPending} />

      <SectionCard
        className={show("operation") ? "" : "hidden"}
        title="Canli onizleme"
        description="Desktop, tablet ve telefon gorunumleri arasinda hizlica gecis yap."
      >
        <div className="flex flex-wrap gap-2">
          <ViewportButton
            active={previewViewport === "desktop"}
            onClick={() => setPreviewViewport("desktop")}
          >
            Desktop
          </ViewportButton>
          <ViewportButton
            active={previewViewport === "tablet"}
            onClick={() => setPreviewViewport("tablet")}
          >
            Tablet
          </ViewportButton>
          <ViewportButton
            active={previewViewport === "phone"}
            onClick={() => setPreviewViewport("phone")}
          >
            Telefon
          </ViewportButton>
          <button
            className="ml-auto inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!previewUrl}
            type="button"
            onClick={openPreview}
          >
            Ayrı sekmede aç
          </button>
        </div>
        <div className={`mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 ${previewWidthClass()} mx-auto`}>
          {previewUrl ? (
            <iframe
              className="h-[640px] w-full bg-white"
              src={previewUrl}
              title="Business preview"
            />
          ) : (
            <div className="grid min-h-[320px] place-items-center px-6 py-12 text-sm text-slate-500">
              Onizleme icin domain gerekli.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        className={show("operation") ? "" : "hidden"}
        title="Operasyon"
        description="Rezervasyonlardan gunluk operasyon listesi uretilir. Filtreler businessId icindeki kayitlara uygulanir."
      >
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile label="Bugun" value={String(operationSummary.today)} />
            <SummaryTile label="Atanan" value={String(operationSummary.assigned)} />
            <SummaryTile label="Bekleyen" value={String(operationSummary.waiting)} />
            <SummaryTile label="Tamamlanan" value={String(operationSummary.completed)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <ViewportButton
              active={operationFilter === "today"}
              onClick={() => setOperationFilter("today")}
            >
              Bugün
            </ViewportButton>
            <ViewportButton
              active={operationFilter === "tomorrow"}
              onClick={() => setOperationFilter("tomorrow")}
            >
              Yarın
            </ViewportButton>
            <ViewportButton
              active={operationFilter === "week"}
              onClick={() => setOperationFilter("week")}
            >
              Bu hafta
            </ViewportButton>
            <ViewportButton
              active={operationFilter === "future"}
              onClick={() => setOperationFilter("future")}
            >
              İleri tarihli
            </ViewportButton>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3">
              {filteredOperations.length ? (
                filteredOperations.map((request) => (
                  <OperationCard
                    key={request.id}
                    request={request}
                    onSave={updateReservationQuick}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Seçili filtre için operasyon yok.
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Pickup listesi</div>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  Saat, rota ve yolcu odaklı kompakt görünüm.
                </p>
              </div>
              {filteredOperations.length ? (
                filteredOperations.map((request) => (
                  <article
                    key={`pickup-${request.id}`}
                    className="grid gap-2 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="font-semibold text-slate-950">
                          {request.customerName}
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {request.travelDate ?? "-"} {request.travelTime ?? ""}
                        </div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatPanelBookingStatusLabel(request.bookingStatus)}
                      </div>
                    </div>
                    <div className="grid gap-1 text-sm text-slate-600">
                      <div>
                        {request.origin ?? "-"} &rarr; {request.destination ?? "-"}
                      </div>
                      <div>
                        Yolcu: {request.adults + request.children + request.infants}
                      </div>
                      <div>Araç: {request.assignedVehicle ?? request.vehicleName ?? "-"}</div>
                      <div>Şoför: {request.driverName ?? "-"}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Pickup listesi boş.
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <Grid>
        <SectionCard
          className={show("company") ? "" : "hidden"}
          title="Firma bilgileri"
          description="Ad, e-posta, telefon ve WhatsApp bilgisini duzenle."
        >
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="business" />
            <Field name="name" label="Firma adi" defaultValue={panel.business?.name ?? ""} />
            <Field name="email" label="Firma email" defaultValue={panel.business?.email ?? ""} />
            <Field name="phone" label="Telefon" defaultValue={panel.business?.phone ?? ""} />
            <Field name="whatsapp" label="WhatsApp" defaultValue={panel.business?.whatsapp ?? ""} />
            <ActionBar
              onPreview={openPreview}
              pending={isPending}
              previewDisabled={!previewUrl}
            />
          </form>
        </SectionCard>

        <SectionCard
          className={show("media") ? "" : "hidden"}
          title="Logo"
          description="Logo adresini guncelle. Harici URL kullan."
        >
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="logo" />
            <Field
              name="logoUrl"
              label="Logo URL"
              defaultValue={panel.business?.logoUrl ?? ""}
              placeholder="https://..."
            />
            <ActionBar
              onPreview={openPreview}
              pending={isPending}
              previewDisabled={!previewUrl}
            />
          </form>
        </SectionCard>

        <SectionCard
          className={show("company") ? "" : "hidden"}
          title="Hero alani"
          description="Ana sayfa basligi, alt metin ve buton yazisi."
        >
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="hero" />
            <Field name="heroTitle" label="Hero baslik" defaultValue={panel.profile.heroTitle} />
            <Field
              name="heroSubtitle"
              label="Hero alt metin"
              defaultValue={panel.profile.heroSubtitle}
            />
            <Field
              name="heroButtonText"
              label="Buton yazisi"
              defaultValue={panel.profile.heroButtonText}
            />
            <ActionBar
              onPreview={openPreview}
              pending={isPending}
              previewDisabled={!previewUrl}
            />
          </form>
        </SectionCard>

        <SectionCard
          className={show("seo") ? "" : "hidden"}
          title="SEO"
          description="Temel meta baslik ve aciklama."
        >
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="seo" />
            <Field name="metaTitle" label="Meta baslik" defaultValue={panel.seo.metaTitle} />
            <Field
              name="metaDescription"
              label="Meta aciklama"
              defaultValue={panel.seo.metaDescription}
            />
            <ActionBar
              onPreview={openPreview}
              pending={isPending}
              previewDisabled={!previewUrl}
            />
          </form>
        </SectionCard>

        <SectionCard
          className={show("domain") ? "" : "hidden"}
          title="Domain"
          description="Business kendi domainini kaydedebilir. Kayit sonrasinda durum pending olur."
        >
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const body = Object.fromEntries(formData.entries());
              const ok = await sendPayload(
                {
                  section: "domain",
                  action: "update",
                  domain: String(body.domain ?? ""),
                },
                "Domain kaydedildi.",
              );

              if (ok) {
                form.reset();
              }
            }}
          >
            <Field
              name="domain"
              label="Domain"
              defaultValue={panel.business?.domain ?? ""}
              placeholder="firma.com"
            />
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">
                Mevcut durum: {panel.business?.domainStatus ?? "pending"}
              </div>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                Public site only opens on active domain.
              </p>
            </div>
            <ActionBar
              onPreview={openPreview}
              pending={isPending}
              previewDisabled={!previewUrl}
            />
          </form>
        </SectionCard>
      </Grid>

      <SectionCard
        className={show("media") ? "" : "hidden"}
        title="Fotoğraf Yönetimi"
        description="Upload entegrasyonu şimdilik güvenli placeholder olarak kalır. URL ve alt metin girerek medya alanlarını yönet."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MEDIA_SLOT_FIELDS.map((slot) => (
            <MediaSlotCardV2
              key={`${slot.kind}-${
                panel.mediaAssets.find((entry) => entry.kind === slot.kind)?.updatedAt ?? "empty"
              }`}
              kind={slot.kind}
              label={slot.label}
              description={slot.description}
              items={panel.mediaAssets}
              onUpload={uploadMediaAsset}
              pending={isPending}
            />
          ))}
        </div>
      </SectionCard>

      {/* Reservations module moved to /app/reservations */}

      <SectionCard
        className={show("customers") ? "" : "hidden"}
        title="Müşteriler / CRM"
        description="Rezervasyonlardan otomatik müşteri kartı oluşur. Aynı telefon veya email mevcut müşteriyle eşleşir."
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <form
            className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const body = Object.fromEntries(formData.entries());
              const ok = await sendPayload(
                {
                  section: "customer",
                  action: "create",
                  fullName: String(body.fullName ?? ""),
                  phone: String(body.phone ?? ""),
                  email: String(body.email ?? ""),
                  country: String(body.country ?? ""),
                  language: String(body.language ?? ""),
                  notes: String(body.notes ?? ""),
                  source: "manual",
                },
                "Müşteri oluşturuldu.",
              );

              if (ok) {
                form.reset();
              }
            }}
          >
            <input type="hidden" name="section" value="customer" />
            <input type="hidden" name="action" value="create" />
            <input type="hidden" name="source" value="manual" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field name="fullName" label="Ad soyad" />
              <Field name="phone" label="Telefon" />
              <Field name="email" label="Email" type="email" />
              <Field name="country" label="Ülke" />
              <Field name="language" label="Dil" />
            </div>
            <TextArea name="notes" label="Not" placeholder="Müşteri notu" />
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              type="submit"
            >
              Müşteri oluştur
            </button>
          </form>

          <div className="grid gap-3">
            {customerViews.length ? (
              customerViews.map((customer) => (
                <article
                  key={customer.id}
                  className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="font-semibold text-slate-950">{customer.fullName}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {customer.phone ?? "-"} / {customer.email ?? "-"}
                      </div>
                    </div>
                    <div className="grid gap-1 text-right text-xs uppercase tracking-[0.2em] text-slate-500">
                      <span>{customer.country ?? "-"}</span>
                      <span>{customer.language ?? "-"}</span>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <div>Rezervasyon: {customer.reservationCount}</div>
                    <div>Toplam harcama: {customer.totalSpend}</div>
                    <div>Kaynak: {customer.source}</div>
                  </div>

                  <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Rezervasyon geçmişi</div>
                    {customer.history.length ? (
                      <div className="grid gap-2 text-sm text-slate-600">
                        {customer.history.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                            <span>{item.label}</span>
                            <span>{item.amount}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Henüz rezervasyon yok.</p>
                    )}
                  </div>

                  <form
                    className="grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const body = Object.fromEntries(formData.entries());
                      await sendPayload(
                        {
                          section: "customer",
                          action: "update",
                          recordId: customer.id,
                          fullName: String(body.fullName ?? customer.fullName),
                          phone: String(body.phone ?? customer.phone ?? ""),
                          email: String(body.email ?? customer.email ?? ""),
                          country: String(body.country ?? customer.country ?? ""),
                          language: String(body.language ?? customer.language ?? ""),
                          notes: String(body.notes ?? customer.notes ?? ""),
                        },
                        "Müşteri güncellendi.",
                      );
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field name="fullName" label="Ad soyad" defaultValue={customer.fullName} />
                      <Field name="phone" label="Telefon" defaultValue={customer.phone ?? ""} />
                      <Field name="email" label="Email" defaultValue={customer.email ?? ""} type="email" />
                      <Field name="country" label="Ülke" defaultValue={customer.country ?? ""} />
                      <Field name="language" label="Dil" defaultValue={customer.language ?? ""} />
                    </div>
                    <TextArea name="notes" label="Not" defaultValue={customer.notes} />
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      type="submit"
                    >
                      Notu kaydet
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Henüz müşteri kaydı yok.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className={show("finance") ? "" : "hidden"}
        title="Finans"
        description="Rezervasyonlar tek tabloda izlenir, tahsilat ve ödeme durumu businessId içinde takip edilir."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3 no-print">
            <div className="grid gap-1">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Finans
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Tahsilat tablosu
              </h3>
              <p className="text-sm text-slate-600">
                Tarih boş bırakılırsa tüm kayıtlar görünür.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => void exportFinanceCsv()}
              >
                CSV Export
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
                onClick={printFinanceTable}
              >
                PDF Yazdır
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryTile
              label="Toplam ciro"
              value={formatFinanceSummaryValue(financeSummary.totalTurnover, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Alınan kapora"
              value={formatFinanceSummaryValue(financeSummary.depositCollected, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Kalan tahsilat"
              value={formatFinanceSummaryValue(financeSummary.remainingCollection, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Araçta tahsil"
              value={formatFinanceSummaryValue(financeSummary.collectedInVehicle, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Ödenen"
              value={formatFinanceSummaryValue(financeSummary.paidTotal, financeSummaryCurrency)}
            />
            <SummaryTile
              label="İade / İptal"
              value={formatFinanceSummaryValue(financeSummary.refundTotal, financeSummaryCurrency)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Toplam kâr"
              value={formatFinanceSummaryValue(financeSummary.totalProfit, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Toplam tedarikçi PASS"
              value={formatFinanceSummaryValue(financeSummary.totalSupplierPass, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Toplam acente PASS"
              value={formatFinanceSummaryValue(financeSummary.totalAgencyPass, financeSummaryCurrency)}
            />
            <SummaryTile
              label="Araçta alınacak"
              value={formatFinanceSummaryValue(financeSummary.vehicleCollection, financeSummaryCurrency)}
            />
          </div>

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 no-print">
            <div className="grid gap-3 xl:grid-cols-5">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Tarih</span>
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  type="date"
                  value={financeDateFilter}
                  onChange={(event) => setFinanceDateFilter(event.target.value)}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Ödeme durumu</span>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  value={financePaymentFilter}
                  onChange={(event) => setFinancePaymentFilter(event.target.value)}
                >
                  <option value="all">Tümü</option>
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Para birimi</span>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  value={financeCurrencyFilter}
                  onChange={(event) => setFinanceCurrencyFilter(event.target.value)}
                >
                  <option value="all">Tümü</option>
                  {financeFilterOptions.currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Kaynak</span>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  value={financeSourceFilter}
                  onChange={(event) => setFinanceSourceFilter(event.target.value)}
                >
                  <option value="all">Tümü</option>
                  {financeFilterOptions.sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Müşteri arama</span>
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Müşteri, telefon, rota, uçuş kodu"
                  value={financeQuery}
                  onChange={(event) => setFinanceQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => setFinanceDateFilter("")}
              >
                Tarihi temizle
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setFinanceDateFilter("");
                  setFinancePaymentFilter("all");
                  setFinanceCurrencyFilter("all");
                  setFinanceSourceFilter("all");
                  setFinanceQuery("");
                }}
              >
                Filtreleri temizle
              </button>
            </div>
          </div>

          <div
            className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm"
            id="finance-print-area"
          >
            <table className="min-w-[1800px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <Th>Tarih</Th>
                  <Th>Saat</Th>
                  <Th>Müşteri</Th>
                  <Th>Nereden → Nereye</Th>
                  <Th>Toplam</Th>
                  <Th>Kapora</Th>
                  <Th>Kalan</Th>
              <Th>Para birimi</Th>
              <Th>Ödeme durumu</Th>
              <Th>Kaynak / Acente</Th>
              <Th>Tedarikçi</Th>
              <Th>Alınan</Th>
              <Th>Acente PASS</Th>
              <Th>Tedarikçi PASS</Th>
              <Th>Kâr</Th>
              <Th>Not</Th>
              <Th className="no-print">Aksiyonlar</Th>
                </tr>
              </thead>
              <tbody>
                {financeRows.length ? (
                  financeRows.map((request) => (
                    <FinanceTableRow
                      key={`finance-${request.id}-${request.totalAmount ?? ""}-${request.depositAmount ?? ""}-${request.remainingAmount ?? ""}-${request.paymentStatus}-${request.notes ?? ""}`}
                      request={request}
                      onSave={updateReservationQuick}
                      onOpenVoucher={() => router.push(`/app/reservations/${request.id}/voucher`)}
                    />
                  ))
                ) : (
                  <tr>
                    <td className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500" colSpan={17}>
                      Finans kaydı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <style jsx global>{`
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            .finance-readonly-value {
              display: none;
            }

            @media print {
              .finance-editable-input {
                display: none !important;
              }

              .finance-readonly-value {
                display: block !important;
              }

              body * {
                visibility: hidden !important;
              }

              #finance-print-area,
              #finance-print-area * {
                visibility: visible !important;
              }

              #finance-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }

              .no-print {
                display: none !important;
              }
            }
          `}</style>
        </div>
      </SectionCard>

      <Grid className={show("services") || show("vehicles") || show("routes") || show("blog") ? "" : "hidden"}>
        <EditableListCard
          className={show("services") ? "" : "hidden"}
          description="Kisa hizmet kayitlari."
          emptyLabel="Henuz hizmet kaydi yok."
          items={panel.services}
          pending={isPending}
          onPreview={previewUrl ? openPreview : undefined}
          previewDisabled={!previewUrl}
          section="service"
          title="Hizmetler"
          onDelete={deleteRecord}
          renderCreateFields={
            <>
              <Field name="title" label="Hizmet adi" placeholder="Airport Transfer" />
              <Field name="description" label="Aciklama" placeholder="..." />
              <Check name="active" label="Aktif" defaultChecked />
            </>
          }
          renderEditFields={(item) => (
            <>
              <Field name="title" label="Hizmet adi" defaultValue={item.title ?? ""} />
              <Field
                name="description"
                label="Aciklama"
                defaultValue={item.description ?? ""}
              />
              <Check name="active" label="Aktif" defaultChecked={item.active ?? true} />
            </>
          )}
          renderSummary={(item) => (
            <>
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">{item.description ?? ""}</div>
            </>
          )}
          submit={submit}
        />

        <EditableListCard
          className={show("vehicles") ? "" : "hidden"}
          description="Arac kategorileri."
          emptyLabel="Henuz arac kaydi yok."
          items={panel.vehicles}
          pending={isPending}
          onPreview={previewUrl ? openPreview : undefined}
          previewDisabled={!previewUrl}
          section="vehicle"
          title="Araclar"
          onDelete={deleteRecord}
          renderCreateFields={
            <>
              <Field name="title" label="Arac adi" placeholder="VIP Van" />
              <Field name="description" label="Aciklama" placeholder="..." />
              <Check name="active" label="Aktif" defaultChecked />
            </>
          }
          renderEditFields={(item) => (
            <>
              <Field name="title" label="Arac adi" defaultValue={item.title ?? ""} />
              <Field
                name="description"
                label="Aciklama"
                defaultValue={item.description ?? ""}
              />
              <Check name="active" label="Aktif" defaultChecked={item.active ?? true} />
            </>
          )}
          renderSummary={(item) => (
            <>
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">{item.description ?? ""}</div>
            </>
          )}
          submit={submit}
        />

        <EditableListCard
          className={show("routes") ? "" : "hidden"}
          description="Populer transfer rotalari."
          emptyLabel="Henuz rota kaydi yok."
          items={panel.routes}
          pending={isPending}
          onPreview={previewUrl ? openPreview : undefined}
          previewDisabled={!previewUrl}
          section="route"
          title="Rotalar"
          onDelete={deleteRecord}
          renderCreateFields={
            <>
              <Field name="title" label="Rota adi" placeholder="Airport - City" />
              <Field name="description" label="Aciklama" placeholder="..." />
              <Check name="active" label="Aktif" defaultChecked />
            </>
          }
          renderEditFields={(item) => (
            <>
              <Field name="title" label="Rota adi" defaultValue={item.title ?? ""} />
              <Field
                name="description"
                label="Aciklama"
                defaultValue={item.description ?? ""}
              />
              <Check name="active" label="Aktif" defaultChecked={item.active ?? true} />
            </>
          )}
          renderSummary={(item) => (
            <>
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">{item.description ?? ""}</div>
            </>
          )}
          submit={submit}
        />

        <EditableListCard
          className={show("blog") ? "" : "hidden"}
          description="Basit yazi kaydi."
          emptyLabel="Henuz blog kaydi yok."
          items={panel.blogs}
          pending={isPending}
          onPreview={previewUrl ? openPreview : undefined}
          previewDisabled={!previewUrl}
          section="blog"
          title="Blog"
          onDelete={deleteRecord}
          renderCreateFields={
            <>
              <Field name="title" label="Yazi basligi" placeholder="Transfer ipuclari" />
              <Field name="slug" label="Slug" placeholder="transfer-ipuclari" />
              <Field name="excerpt" label="Kisa ozet" placeholder="..." />
              <TextArea
                name="content"
                label="Icerik"
                placeholder="..."
              />
              <Check name="published" label="Yayinda" />
            </>
          }
          renderEditFields={(item) => (
            <>
              <Field name="title" label="Yazi basligi" defaultValue={item.title ?? ""} />
              <Field name="slug" label="Slug" defaultValue={item.slug ?? ""} />
              <Field name="excerpt" label="Kisa ozet" defaultValue={item.excerpt ?? ""} />
              <TextArea
                name="content"
                label="Icerik"
                defaultValue={item.content ?? ""}
              />
              <Check name="published" label="Yayinda" defaultChecked={item.published ?? false} />
            </>
          )}
          renderSummary={(item) => (
            <>
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">{item.excerpt ?? ""}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                {item.published ? "Yayinda" : "Taslak"}
              </div>
            </>
          )}
          submit={submit}
        />
      </Grid>

      <SectionCard
        className={show("languages") ? "" : "hidden"}
        title="Dil yönetimi"
        description="Temel dil kaydı oluştur ve mevcut kaydı güncelle."
      >
        <EditableListCard
          description="Dil kayitlari."
          emptyLabel="Henuz dil kaydi yok."
          items={panel.locales}
          pending={isPending}
          onPreview={previewUrl ? openPreview : undefined}
          previewDisabled={!previewUrl}
          section="locale"
          title=""
          onDelete={deleteRecord}
          renderCreateFields={
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="code" label="Kod" placeholder="tr" />
                <Field name="name" label="Dil adi" placeholder="Turkce" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Check name="active" label="Aktif" defaultChecked />
                <Check name="published" label="Yayinda" />
                <Check name="translationComplete" label="Ceviri tamam" />
              </div>
            </>
          }
          renderEditFields={(item) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="code" label="Kod" defaultValue={item.code ?? ""} />
                <Field name="name" label="Dil adi" defaultValue={item.name ?? ""} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Check name="active" label="Aktif" defaultChecked={item.active ?? true} />
                <Check name="published" label="Yayinda" defaultChecked={item.published ?? false} />
                <Check
                  name="translationComplete"
                  label="Ceviri tamam"
                  defaultChecked={item.translationComplete ?? false}
                />
              </div>
            </>
          )}
          renderSummary={(item) => (
            <>
              <div className="font-medium text-slate-900">
                {item.code?.toUpperCase()} - {item.name}
              </div>
              <div className="text-sm text-slate-600">
                {item.active ? "Aktif" : "Pasif"}
                {" / "}
                {item.published ? "Yayinda" : "Taslak"}
                {" / "}
                {item.translationComplete ? "Ceviri tamam" : "Ceviri eksik"}
              </div>
            </>
          )}
          submit={submit}
        />
      </SectionCard>

      <SectionCard
        className={show("password") ? "" : "hidden"}
        title="Admin sifresi"
        description="Kendi admin sifreni degistir. Hash response icinde donmez."
      >
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const body = Object.fromEntries(formData.entries());
            const ok = await sendPayload(
              {
                section: "password",
                newPassword: String(body.newPassword ?? ""),
                confirmPassword: String(body.confirmPassword ?? ""),
              },
              "Sifre guncellendi.",
            );

            if (ok) {
              form.reset();
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              name="newPassword"
              label="Yeni sifre"
              type="password"
              placeholder="Yeni sifre"
            />
            <Field
              name="confirmPassword"
              label="Sifre tekrar"
              type="password"
              placeholder="Yeni sifre"
            />
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Sifre degisimi gercek users tablosuna yazilir.
          </div>
          <ActionBar
            onPreview={openPreview}
            pending={isPending}
            previewDisabled={!previewUrl}
          />
        </form>
      </SectionCard>
    </section>
  );
}

function EditableListCard<T extends CollectionItem>({
  title,
  description,
  section,
  items,
  submit,
  onDelete,
  onPreview,
  renderCreateFields,
  renderEditFields,
  renderSummary,
  emptyLabel,
  pending,
  previewDisabled,
  className = "",
}: {
  title: string;
  description: string;
  section: CollectionSection;
  items: T[];
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (section: CollectionSection, recordId: string) => Promise<void>;
  onPreview?: (() => void) | undefined;
  renderCreateFields: ReactNode;
  renderEditFields: (item: T) => ReactNode;
  renderSummary: (item: T) => ReactNode;
  emptyLabel: string;
  pending: boolean;
  previewDisabled: boolean;
  className?: string;
}) {
  const body = (
    <>
      <form className="grid gap-3" onSubmit={submit}>
        <input type="hidden" name="section" value={section} />
        {renderCreateFields}
        <ActionBar
          onPreview={onPreview}
          pending={pending}
          previewDisabled={previewDisabled}
          publishDisabled
          publishHidden={section !== "blog" && section !== "locale"}
        />
      </form>

      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">{renderSummary(item)}</div>
                <button
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  type="button"
                  onClick={() => onDelete(section, item.id)}
                >
                  Sil
                </button>
              </div>

              <form className="mt-4 grid gap-3" onSubmit={submit}>
                <input type="hidden" name="section" value={section} />
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="recordId" value={item.id} />
                {renderEditFields(item)}
                <ActionBar
                  onPreview={onPreview}
                  pending={pending}
                  previewDisabled={previewDisabled}
                  publishDisabled
                  publishHidden={section !== "blog" && section !== "locale"}
                />
              </form>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </>
  );

  if (!title) {
    return <div className={`grid gap-4 ${className}`.trim()}>{body}</div>;
  }

  return (
    <SectionCard title={title} description={description} className={className}>
      {body}
    </SectionCard>
  );
}

function SectionCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`.trim()}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </article>
  );
}

function MediaSlotCard({
  kind,
  label,
  description,
  items,
  onSave,
  pending,
}: {
  kind: MediaSlotKey;
  label: string;
  description: string;
  items: BusinessPanelData["mediaAssets"];
  onSave: (
    payload: Record<string, string | boolean | number | undefined>,
    successMessage: string,
  ) => Promise<boolean>;
  pending: boolean;
}) {
  const asset = items.find((entry) => entry.kind === kind) ?? null;
  const sourceUrl = asset?.sourceUrl?.trim() ?? "";
  const altText = asset?.altText?.trim() ?? "";

  async function handleDelete() {
    await onSave(
      {
        section: "media",
        action: "delete",
        kind,
      },
      "Medya silindi.",
    );
  }

  return (
    <article className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-1">
        <div className="text-sm font-semibold text-slate-950">{label}</div>
        <p className="text-xs leading-6 text-slate-500">{description}</p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
        {sourceUrl ? (
          <img
            alt={altText || label}
            className="aspect-[16/10] h-full w-full object-cover"
            src={sourceUrl}
          />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-slate-100 px-6 text-center text-xs leading-6 text-slate-500">
            Placeholder
          </div>
        )}
      </div>

      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const body = Object.fromEntries(formData.entries());
          await onSave(
            {
              section: "media",
              action: "update",
              kind,
              sourceUrl: String(body.sourceUrl ?? ""),
              altText: String(body.altText ?? ""),
              sortOrder: Number(body.sortOrder ?? 0),
            },
            "Medya kaydedildi.",
          );
        }}
      >
        <input type="hidden" name="sortOrder" value="0" />
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Görsel URL</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            defaultValue={sourceUrl}
            name="sourceUrl"
            placeholder="https://..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Alt metin</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            defaultValue={altText}
            name="altText"
            placeholder={label}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
            type="submit"
          >
            Kaydet
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
            type="button"
            onClick={() => {
              void handleDelete();
            }}
          >
            Temizle
          </button>
        </div>
      </form>
    </article>
  );
}

function MediaSlotCardV2({
  kind,
  label,
  description,
  items,
  onUpload,
  pending,
}: {
  kind: MediaSlotKey;
  label: string;
  description: string;
  items: BusinessPanelData["mediaAssets"];
  onUpload: (
    formData: FormData,
    successMessage: string,
  ) => Promise<boolean>;
  pending: boolean;
}) {
  const router = useRouter();
  const asset = items.find((entry) => entry.kind === kind) ?? null;
  const metadata = asset?.metadata ?? null;
  const sourceUrl = asset?.sourceUrl?.trim() ?? "";
  const [draftSrc, setDraftSrc] = useState(metadata?.previewDataUrl?.trim() || sourceUrl);
  const [draftAlt, setDraftAlt] = useState(
    metadata?.altText?.trim() || asset?.altText?.trim() || label,
  );
  const [cropX, setCropX] = useState(String(metadata?.cropX ?? 50));
  const [cropY, setCropY] = useState(String(metadata?.cropY ?? 50));
  const [zoom, setZoom] = useState(String(metadata?.zoom ?? 1));
  const [cover, setCover] = useState(Boolean(metadata?.cover ?? true));
  const [fileName, setFileName] = useState(metadata?.fileName?.trim() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    const formData = new FormData();
    formData.set("section", "media");
    formData.set("action", "delete");
    formData.set("kind", kind);

    const ok = await onUpload(formData, "Medya silindi.");

    if (ok) {
      router.refresh();
    }
  }

  return (
    <article className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-1">
        <div className="text-sm font-semibold text-slate-950">{label}</div>
        <p className="text-xs leading-6 text-slate-500">{description}</p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
        {draftSrc ? (
          <img
            alt={draftAlt || label}
            className="aspect-[16/10] h-full w-full"
            src={draftSrc}
            style={{
              objectFit: cover ? "cover" : "contain",
              objectPosition: `${cropX}% ${cropY}%`,
              transform: `scale(${Math.max(Number(zoom) || 1, 0.1)})`,
              transformOrigin: "center",
            }}
          />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-slate-100 px-6 text-center text-xs leading-6 text-slate-500">
            Placeholder
          </div>
        )}
      </div>

      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            const formData = new FormData();
            formData.set("section", "media");
            formData.set("action", "update");
            formData.set("kind", kind);
            formData.set("previewDataUrl", draftSrc);
            formData.set("fileName", fileName || selectedFile?.name || "");
            formData.set("altText", draftAlt);
            formData.set("cropX", cropX);
            formData.set("cropY", cropY);
            formData.set("zoom", zoom);
            formData.set("slot", kind);
            formData.set("cover", String(cover));
            formData.set("sortOrder", "0");
            if (selectedFile) {
              formData.set("file", selectedFile);
            }

            await onUpload(formData, "Medya kaydedildi.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <input type="hidden" name="sortOrder" value="0" />
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Dosya seç</span>
          <input
            accept="image/*"
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400"
            type="file"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              if (!file) {
                setSelectedFile(null);
                return;
              }

              setSelectedFile(file);
              setFileName(file.name);
              const reader = new FileReader();
              reader.onload = () => {
                setDraftSrc(String(reader.result ?? ""));
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Alt metin</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            value={draftAlt}
            onChange={(event) => setDraftAlt(event.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <FieldControl label="Crop X %" max="100" min="0" value={cropX} onChange={setCropX} />
          <FieldControl label="Crop Y %" max="100" min="0" value={cropY} onChange={setCropY} />
          <FieldControl label="Zoom" max="3" min="1" step="0.05" value={zoom} onChange={setZoom} />
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input checked={cover} type="checkbox" onChange={(event) => setCover(event.target.checked)} />
          <span>Kapak olarak kullan</span>
        </label>
        {fileName ? <p className="text-xs leading-6 text-slate-500">Dosya: {fileName}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending || saving}
            type="submit"
          >
            Kaydet
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending || saving}
            type="button"
            onClick={() => {
              void handleDelete();
            }}
          >
            Temizle
          </button>
        </div>
      </form>
    </article>
  );
}

void MediaSlotCard;

function OperationCard({
  request,
  onSave,
}: {
  request: OperationView;
  onSave: (
    reservationId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({
    assignedVehicle: request.assignedVehicle ?? "",
    driverName: request.driverName ?? "",
    pickupStatus: request.pickupStatus ?? "",
    operationNotes: request.operationNotes ?? "",
  });
  const [saving, setSaving] = useState(false);

  return (
    <article className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="font-semibold text-slate-950">{request.customerName}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {request.travelDate ?? "-"} {request.travelTime ?? ""}
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {formatPanelBookingStatusLabel(request.bookingStatus)}
        </div>
      </div>

      <div className="grid gap-2 text-sm text-slate-600">
        <div>{request.phone ?? "-"}</div>
        <div>
          {request.origin ?? "-"} → {request.destination ?? "-"}
        </div>
        <div>Yolcu: {request.adults + request.children + request.infants}</div>
        <div>Tedarikçi: {request.supplierName ?? "-"}</div>
        <div>Araç: {request.vehicleName ?? request.assignedVehicle ?? "-"}</div>
        <div>Tedarikçi tahsilatı: {formatMoneyValue(request.supplierCollection ?? 0, request.currency)}</div>
        <div>Araçta alınacak: {formatMoneyValue(request.remainingAmount ?? 0, request.currency)}</div>
        <div>Not: {request.notes ?? "-"}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Atanan araç"
          name={`assignedVehicle-${request.id}`}
          value={draft.assignedVehicle}
          onChange={(value) => setDraft((current) => ({ ...current, assignedVehicle: value }))}
        />
        <Field
          label="Şoför"
          name={`driverName-${request.id}`}
          value={draft.driverName}
          onChange={(value) => setDraft((current) => ({ ...current, driverName: value }))}
        />
        <TextArea
          label="Pickup notu"
          name={`pickupStatus-${request.id}`}
          value={draft.pickupStatus}
          onChange={(value) => setDraft((current) => ({ ...current, pickupStatus: value }))}
        />
        <TextArea
          label="Operasyon notu"
          name={`operationNotes-${request.id}`}
          value={draft.operationNotes}
          onChange={(value) => setDraft((current) => ({ ...current, operationNotes: value }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={saving}
          type="button"
          onClick={async () => {
            setSaving(true);
            await onSave(
              request.id,
              {
                assignedVehicle: draft.assignedVehicle,
                driverName: draft.driverName,
                pickupStatus: draft.pickupStatus,
                operationNotes: draft.operationNotes,
              },
              "Operasyon kaydedildi.",
            );
            setSaving(false);
          }}
        >
          Kaydet
        </button>
      </div>
    </article>
  );
}

function FinanceTableRow({
  request,
  onSave,
  onOpenVoucher,
}: {
  request: OperationView;
  onSave: (
    reservationId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<boolean>;
  onOpenVoucher: () => void;
}) {
  const [draft, setDraft] = useState<{
    totalAmount: string;
    depositAmount: string;
    remainingAmount: string;
    paymentStatus: string;
    notes: string;
    supplierName: string;
    agencyName: string;
    collectedAmount: string;
    supplierPass: string;
    agencyPass: string;
    supplierCollection: string;
  }>({
    totalAmount: String(request.totalAmount ?? ""),
    depositAmount: String(request.depositAmount ?? ""),
    remainingAmount: String(request.remainingAmount ?? ""),
    paymentStatus: formatPaymentStatusLabel(request.paymentStatus),
    notes: String(request.notes ?? ""),
    supplierName: String(request.supplierName ?? ""),
    agencyName: String(request.agencyName ?? ""),
    collectedAmount: String(request.collectedAmount ?? ""),
    supplierPass: String(request.supplierPass ?? ""),
    agencyPass: String(request.agencyPass ?? ""),
    supplierCollection: String(request.supplierCollection ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const routeLabel = [request.origin, request.destination].filter(Boolean).join(" → ") || "-";
  const profit =
    Number(draft.collectedAmount || 0) +
    Number(draft.agencyPass || 0) -
    Number(draft.supplierPass || 0);

  async function saveRow() {
    setSaving(true);

    try {
      await onSave(
        request.id,
        {
          totalAmount: draft.totalAmount,
          depositAmount: draft.depositAmount,
          remainingAmount: draft.remainingAmount,
          paymentStatus: draft.paymentStatus,
          notes: draft.notes,
          supplierName: draft.supplierName,
          agencyName: draft.agencyName,
          collectedAmount: draft.collectedAmount,
          supplierPass: draft.supplierPass,
          agencyPass: draft.agencyPass,
          supplierCollection: draft.supplierCollection,
          profit: String(profit),
        },
        "Tahsilat güncellendi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50/60">
      <Td>{request.travelDate ?? "-"}</Td>
      <Td>{request.travelTime ?? "-"}</Td>
      <Td>
        <div className="grid gap-1">
          <div className="font-semibold text-slate-950">{request.customerName}</div>
          <div className="text-xs text-slate-500">{request.phone ?? "-"}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-1">
          <div className="font-medium text-slate-900">{routeLabel}</div>
          <div className="text-xs text-slate-500">{request.flightCode ?? "-"}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.totalAmount}
            onChange={(event) => setDraft((current) => ({ ...current, totalAmount: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.totalAmount, request.currency)}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.depositAmount}
            onChange={(event) => setDraft((current) => ({ ...current, depositAmount: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.depositAmount, request.currency)}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.remainingAmount}
            onChange={(event) => setDraft((current) => ({ ...current, remainingAmount: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.remainingAmount, request.currency)}</div>
        </div>
      </Td>
      <Td>{request.currency ?? "-"}</Td>
      <Td>
        <div className="grid gap-2">
          <select
            className="finance-editable-input h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            value={draft.paymentStatus}
            onChange={(event) => setDraft((current) => ({ ...current, paymentStatus: event.target.value }))}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-500 finance-readonly-value">{formatPaymentStatusLabel(request.paymentStatus)}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            value={draft.agencyName}
            onChange={(event) => setDraft((current) => ({ ...current, agencyName: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{request.source ?? "-"}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            value={draft.supplierName}
            onChange={(event) => setDraft((current) => ({ ...current, supplierName: event.target.value }))}
          />
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            placeholder="Tedarikçi tahsilatı"
            value={draft.supplierCollection}
            onChange={(event) => setDraft((current) => ({ ...current, supplierCollection: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">
            {request.supplierCollection ? formatMoneyValue(request.supplierCollection, request.currency) : "-"}
          </div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.collectedAmount}
            onChange={(event) => setDraft((current) => ({ ...current, collectedAmount: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.collectedAmount, request.currency)}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.agencyPass}
            onChange={(event) => setDraft((current) => ({ ...current, agencyPass: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.agencyPass, request.currency)}</div>
        </div>
      </Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            inputMode="decimal"
            value={draft.supplierPass}
            onChange={(event) => setDraft((current) => ({ ...current, supplierPass: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{financeCellText(request.supplierPass, request.currency)}</div>
        </div>
      </Td>
      <Td>{formatMoneyValue(profit, request.currency)}</Td>
      <Td>
        <div className="grid gap-2">
          <input
            className="finance-editable-input h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
          <div className="text-xs text-slate-500 finance-readonly-value">{request.notes ?? "-"}</div>
        </div>
      </Td>
      <Td className="no-print">
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={onOpenVoucher}
          >
            Voucher aç
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded-2xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
            type="button"
            onClick={() => {
              void saveRow();
            }}
          >
            Kaydet
          </button>
        </div>
      </Td>
    </tr>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`border-t border-slate-200 px-4 py-3 ${className}`.trim()} scope="col">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-t border-slate-200 px-4 py-4 align-top ${className}`.trim()}>{children}</td>;
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
    </div>
  );
}

function ViewportButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
        active
          ? "border border-slate-900 bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-4 lg:grid-cols-2 ${className}`.trim()}>{children}</div>;
}

function Field({
  name,
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
      />
    </label>
  );
}

function FieldControl({
  label,
  value,
  onChange,
  min = "0",
  max = "100",
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        placeholder={placeholder}
        value={value}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
      />
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input
        className="h-4 w-4"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value="true"
      />
      <span>{label}</span>
    </label>
  );
}

function ActionBar({
  onPreview,
  pending,
  previewDisabled,
  publishHidden = true,
  publishDisabled = true,
}: {
  onPreview?: (() => void) | undefined;
  pending: boolean;
  previewDisabled: boolean;
  publishHidden?: boolean;
  publishDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        Kaydet
      </button>
      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={pending || previewDisabled || !onPreview}
        type="button"
        onClick={onPreview}
      >
        Onizle
      </button>
      {publishHidden ? null : (
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={publishDisabled || pending}
          type="button"
        >
          Yayinla
        </button>
      )}
    </div>
  );
}

function Notice({ state, pending }: { state: SaveState; pending: boolean }) {
  const hidden = state.status === "idle" && !pending;
  if (hidden) return null;

  const tone =
    state.status === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : state.status === "saved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-[24px] border px-5 py-4 text-sm ${tone}`}>{state.message}</div>
  );
}



