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
      "reservation",
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
            : section === "reservation"
              ? {
                  section,
                  action: toStringValue(body?.action) || undefined,
                  recordId: toStringValue(body?.recordId) || undefined,
                  customerName: toStringValue(body?.customerName),
                  phone: toStringValue(body?.phone),
                  email: toStringValue(body?.email),
                  country: toStringValue(body?.country),
                  language: toStringValue(body?.language),
                  origin: toStringValue(body?.origin),
                  destination: toStringValue(body?.destination),
                  travelDate: toStringValue(body?.travelDate),
                  travelTime: toStringValue(body?.travelTime),
                  flightCode: toStringValue(body?.flightCode),
                  adults: Number(body?.adults ?? 0),
                  children: Number(body?.children ?? 0),
                  infants: Number(body?.infants ?? 0),
                  vehicleCategory: toStringValue(body?.vehicleCategory),
                  vehicleName: toStringValue(body?.vehicleName),
                  assignedVehicle: toStringValue(body?.assignedVehicle),
                  driverName: toStringValue(body?.driverName),
                  totalAmount: toStringValue(body?.totalAmount),
                  depositAmount: toStringValue(body?.depositAmount),
                  remainingAmount: toStringValue(body?.remainingAmount),
                  currency: toStringValue(body?.currency),
                  paymentStatus: toStringValue(body?.paymentStatus),
                  notes: toStringValue(body?.notes),
                  source: toStringValue(body?.source),
                  bookingStatus: toStringValue(body?.bookingStatus),
                  message: toStringValue(body?.message),
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

    const panel = await updateBusinessPanelSection(
      auth.session.businessId,
      payload as Parameters<typeof updateBusinessPanelSection>[1],
    );

    return NextResponse.json({ ok: true, panel });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guncelleme basarisiz.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
