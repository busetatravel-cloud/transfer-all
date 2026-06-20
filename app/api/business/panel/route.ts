import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getBusinessPanelData, updateBusinessPanelSection } from "@/lib/business-panel";

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toBooleanValue(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  return false;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const safe = normalizeString(value);
  return safe || undefined;
}

function extractErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && code.trim() ? code : "update_failed";
  }

  return "update_failed";
}

function validateReservationPayload(body: Record<string, unknown> | null) {
  const fieldErrors: Record<string, string> = {};
  const customerName = normalizeString(body?.customerName);
  const origin = normalizeString(body?.origin);
  const destination = normalizeString(body?.destination);
  const travelDate = normalizeString(body?.travelDate);
  const travelTime = normalizeString(body?.travelTime);

  if (!customerName) fieldErrors.customerName = "Musteri adı gerekli.";
  if (!origin) fieldErrors.origin = "Nereden alanı gerekli.";
  if (!destination) fieldErrors.destination = "Nereye alanı gerekli.";
  if (!travelDate) fieldErrors.travelDate = "Tarih gerekli.";
  if (!travelTime) fieldErrors.travelTime = "Saat gerekli.";

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

void normalizeOptionalString;
void validateReservationPayload;

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const panel = await getBusinessPanelData(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    panel,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  console.info("business.panel.patch", {
    section: body?.section,
    action: body?.action,
    payload: body?.payload ?? body,
  });

  const section = body?.section;

  if (
    typeof section !== "string" ||
    ![
      "business",
      "domain",
      "password",
      "logo",
      "hero",
      "media",
      "customer",
      "service",
      "vehicle",
      "route",
      "blog",
      "seo",
      "locale",
    ].includes(section)
  ) {
    return NextResponse.json(
      { error: "Gecersiz alan." },
      { status: 400 },
    );
  }

  try {
    if (section === "reservation") {
      return NextResponse.json(
        {
          ok: false,
          code: "reservation_moved",
          message: "Rezervasyon işlemi artık /api/business/reservations üzerinden yönetiliyor.",
        },
        { status: 400 },
      );
    }

    const payload =
      section === "business"
        ? {
            section,
            action: toStringValue(body?.action) || undefined,
            recordId: toStringValue(body?.recordId) || undefined,
            name: toStringValue(body?.name),
            email: toStringValue(body?.email),
            phone: toStringValue(body?.phone),
            whatsapp: toStringValue(body?.whatsapp),
          }
        : section === "domain"
          ? {
              section,
              action: toStringValue(body?.action) || undefined,
              recordId: toStringValue(body?.recordId) || undefined,
              domain: toStringValue(body?.domain),
            }
        : section === "password"
          ? {
              section,
              action: toStringValue(body?.action) || undefined,
              recordId: toStringValue(body?.recordId) || undefined,
              userId: auth.session.userId,
              newPassword: toStringValue(body?.newPassword),
              confirmPassword: toStringValue(body?.confirmPassword),
            }
        : section === "logo"
          ? {
              section,
              action: toStringValue(body?.action) || undefined,
              recordId: toStringValue(body?.recordId) || undefined,
              logoUrl: toStringValue(body?.logoUrl),
            }
          : section === "hero"
            ? {
                section,
                action: toStringValue(body?.action) || undefined,
                recordId: toStringValue(body?.recordId) || undefined,
                heroTitle: toStringValue(body?.heroTitle),
                heroSubtitle: toStringValue(body?.heroSubtitle),
                heroButtonText: toStringValue(body?.heroButtonText),
              }
            : section === "media"
              ? {
                  section,
                  action: toStringValue(body?.action) || undefined,
                  recordId: toStringValue(body?.recordId) || undefined,
                  kind: toStringValue(body?.kind),
                  sourceUrl: toStringValue(body?.sourceUrl),
                  altText: toStringValue(body?.altText),
                  fileName: toStringValue(body?.fileName),
                  previewDataUrl: toStringValue(body?.previewDataUrl),
                  cropX: Number(body?.cropX ?? 50),
                  cropY: Number(body?.cropY ?? 50),
                  zoom: Number(body?.zoom ?? 1),
                  slot: toStringValue(body?.slot),
                  cover: toBooleanValue(body?.cover),
                  sortOrder: Number(body?.sortOrder ?? 0),
                }
            : section === "customer"
              ? {
                  section,
                  action: toStringValue(body?.action) || undefined,
                  recordId: toStringValue(body?.recordId) || undefined,
                  fullName: toStringValue(body?.fullName),
                  email: toStringValue(body?.email),
                  phone: toStringValue(body?.phone),
                  country: toStringValue(body?.country),
                  language: toStringValue(body?.language),
                  notes: toStringValue(body?.notes),
                  source: toStringValue(body?.source),
                }
            : section === "service" || section === "vehicle" || section === "route"
              ? {
                  section,
                  action: toStringValue(body?.action) || undefined,
                  recordId: toStringValue(body?.recordId) || undefined,
                  title: toStringValue(body?.title),
                  description: toStringValue(body?.description),
                  active: toBooleanValue(body?.active),
                  sortOrder: Number(body?.sortOrder ?? 0),
                }
              : section === "blog"
                ? {
                    section,
                    action: toStringValue(body?.action) || undefined,
                    recordId: toStringValue(body?.recordId) || undefined,
                    title: toStringValue(body?.title),
                    slug: toStringValue(body?.slug),
                    excerpt: toStringValue(body?.excerpt),
                    content: toStringValue(body?.content),
                    published: toBooleanValue(body?.published),
                    sortOrder: Number(body?.sortOrder ?? 0),
                  }
                : section === "seo"
                  ? {
                      section,
                      action: toStringValue(body?.action) || undefined,
                      recordId: toStringValue(body?.recordId) || undefined,
                      metaTitle: toStringValue(body?.metaTitle),
                      metaDescription: toStringValue(body?.metaDescription),
                      defaultLocale: toStringValue(body?.defaultLocale),
                      hreflangEnabled: toBooleanValue(body?.hreflangEnabled),
                    }
                  : {
                      section,
                      action: toStringValue(body?.action) || undefined,
                      recordId: toStringValue(body?.recordId) || undefined,
                      code: toStringValue(body?.code),
                      name: toStringValue(body?.name),
                      active: toBooleanValue(body?.active),
                      published: toBooleanValue(body?.published),
                      translationComplete: toBooleanValue(
                        body?.translationComplete,
                      ),
                    };

    console.info("business.panel.payload", {
      section,
      action: payload.action,
      payload,
    });

    const panel = await updateBusinessPanelSection(
      auth.session.businessId,
      payload as Parameters<typeof updateBusinessPanelSection>[1],
    );

    return NextResponse.json({ ok: true, panel });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guncelleme basarisiz.";

    return NextResponse.json(
      {
        ok: false,
        code: extractErrorCode(error),
        message,
        fieldErrors:
          typeof error === "object" && error && "fieldErrors" in error
            ? (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? null
            : null,
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
