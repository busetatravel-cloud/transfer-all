import { NextResponse } from "next/server";
import { getActiveBusinessByDomain } from "@/lib/business";
import { createBusinessRequest } from "@/lib/requests";
import { isPlatformHost, normalizeHost } from "@/lib/platform";

function getRequestHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return normalizeHost(host);
}

export async function POST(request: Request) {
  const host = getRequestHost(request);

  if (!host || isPlatformHost(host)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const business = await getActiveBusinessByDomain(host);

  if (!business) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        customerName?: string;
        phone?: string;
        email?: string;
        message?: string;
      }
    | null;

  const customerName = body?.customerName?.trim() ?? "";
  const message = body?.message?.trim() ?? "";

  if (!customerName || !message) {
    return NextResponse.json(
      { error: "Ad soyad ve mesaj gerekli." },
      { status: 400 },
    );
  }

  const requestRecord = await createBusinessRequest(business.id, {
    customerName,
    phone: body?.phone?.trim() ?? "",
    email: body?.email?.trim() ?? "",
    message,
  });

  return NextResponse.json({
    ok: true,
    requestId: requestRecord.id,
  });
}
