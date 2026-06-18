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
            name: toStringValue(body?.name),
            email: toStringValue(body?.email),
            phone: toStringValue(body?.phone),
            whatsapp: toStringValue(body?.whatsapp),
          }
        : section === "domain"
          ? {
              section,
              domain: toStringValue(body?.domain),
            }
        : section === "password"
          ? {
              section,
              userId: auth.session.userId,
              newPassword: toStringValue(body?.newPassword),
              confirmPassword: toStringValue(body?.confirmPassword),
            }
        : section === "logo"
          ? {
              section,
              logoUrl: toStringValue(body?.logoUrl),
            }
          : section === "hero"
            ? {
                section,
                heroTitle: toStringValue(body?.heroTitle),
                heroSubtitle: toStringValue(body?.heroSubtitle),
                heroButtonText: toStringValue(body?.heroButtonText),
              }
            : section === "service" || section === "vehicle" || section === "route"
              ? {
                  section,
                  title: toStringValue(body?.title),
                  description: toStringValue(body?.description),
                }
              : section === "blog"
                ? {
                    section,
                    title: toStringValue(body?.title),
                    slug: toStringValue(body?.slug),
                    excerpt: toStringValue(body?.excerpt),
                    content: toStringValue(body?.content),
                  }
                : section === "seo"
                  ? {
                      section,
                      metaTitle: toStringValue(body?.metaTitle),
                      metaDescription: toStringValue(body?.metaDescription),
                    }
                  : {
                      section,
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
