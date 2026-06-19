import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordBusinessAnalyticsEvent } from "@/lib/analytics";
import { getActiveBusinessByDomain } from "@/lib/business";
import { normalizeHost, isPlatformHost } from "@/lib/platform";

function getRequestHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return normalizeHost(host);
}

export async function POST(request: Request) {
  const host = getRequestHost(request);
  const body = (await request.json().catch(() => null)) as
    | {
        pagePath?: string;
        pageType?: string;
        referrer?: string;
        userAgent?: string;
      }
    | null;

  if (!host || isPlatformHost(host)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const business = await getActiveBusinessByDomain(host);

  if (!business) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!body?.pagePath || !body?.pageType) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "path ve pageType gerekli.",
        code: "analytics_payload_required",
      },
      { status: 400 },
    );
  }

  await recordBusinessAnalyticsEvent(business.id, {
    eventName: "visit",
    pagePath: body.pagePath,
    pageType: body.pageType,
    referrer: body.referrer,
    userAgent: body.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ ok: true });
}
