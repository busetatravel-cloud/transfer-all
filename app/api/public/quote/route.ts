import { NextResponse } from "next/server";
import { getBusinessById, getActiveBusinessByDomain } from "@/lib/business";
import { recordBusinessAnalyticsEvent } from "@/lib/analytics";
import { createBusinessRequest } from "@/lib/requests";
import { isPlatformHost, normalizeHost } from "@/lib/platform";

function getRequestHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return normalizeHost(host);
}

async function resolvePreviewBusiness(businessId: string) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return getBusinessById(businessId);
}

export async function POST(request: Request) {
  const host = getRequestHost(request);
  const referrer = request.headers.get("referer") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const body = (await request.json().catch(() => null)) as
    | {
        businessId?: string;
        previewBusinessId?: string;
        customerName?: string;
        phone?: string;
        email?: string;
        message?: string;
      }
    | null;

  const customerName = body?.customerName?.trim() ?? "";
  const message = body?.message?.trim() ?? "Manuel rezervasyon";
  const businessId = body?.businessId?.trim() ?? "";
  const previewBusinessId = body?.previewBusinessId?.trim() ?? "";

  if (!customerName || !message) {
    return NextResponse.json(
      { error: "Ad soyad ve mesaj gerekli." },
      { status: 400 },
    );
  }

  if (host && !isPlatformHost(host)) {
    const business = await getActiveBusinessByDomain(host);

    if (!business) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (businessId && businessId !== business.id) {
      return NextResponse.json(
        { error: "Business uyumsuz." },
        { status: 400 },
      );
    }

    const requestRecord = await createBusinessRequest(business.id, {
      customerName,
      phone: body?.phone?.trim() ?? "",
      email: body?.email?.trim() ?? "",
      message,
      source: "web",
      bookingStatus: "Bekliyor",
    });

    try {
      await recordBusinessAnalyticsEvent(business.id, {
        eventName: "conversion",
        pagePath: "/quote",
        pageType: "quote",
        referrer,
        userAgent,
      });
    } catch (error) {
      console.warn("analytics.conversion.failed", {
        businessId: business.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: requestRecord.id,
    });
  }

  const previewBusiness =
    previewBusinessId ? await resolvePreviewBusiness(previewBusinessId) : null;

  if (!previewBusiness) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (businessId && businessId !== previewBusiness.id) {
    return NextResponse.json(
      { error: "Business uyumsuz." },
      { status: 400 },
    );
  }

  const requestRecord = await createBusinessRequest(previewBusiness.id, {
    customerName,
    phone: body?.phone?.trim() ?? "",
    email: body?.email?.trim() ?? "",
    message,
    source: "web",
    bookingStatus: "Bekliyor",
  });

  return NextResponse.json({
    ok: true,
    requestId: requestRecord.id,
  });
}
