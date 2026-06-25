import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { updateBusinessDomainRecord } from "@/lib/business";
import {
  DOMAIN_STATUS_OPTIONS,
  type DomainAppStatus,
  type DomainDnsStatus,
  type DomainSslStatus,
} from "@/lib/domain-utils";

function normalizeStatus(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DOMAIN_STATUS_OPTIONS.includes(normalized as (typeof DOMAIN_STATUS_OPTIONS)[number])
    ? normalized
    : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        domain?: string;
        hostname?: string;
        domainStatus?: string;
        verificationRequired?: boolean;
        verificationType?: string | null;
        verificationName?: string | null;
        verificationValue?: string | null;
        vercelDomainError?: string | null;
        dnsStatus?: DomainDnsStatus | null;
        sslStatus?: DomainSslStatus | null;
        appStatus?: DomainAppStatus | null;
      }
    | null;

  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";
  const hostname = typeof body?.hostname === "string" ? body.hostname.trim() : "";
  const domainStatus = normalizeStatus(body?.domainStatus);

  if (body?.domainStatus && !domainStatus) {
    return NextResponse.json(
      { error: "Geçersiz domain durumu." },
      { status: 400 },
    );
  }

  if (domainStatus === "active") {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Active durumu manuel atanamaz. Sadece gerçek provider/DNS/SSL sonucu ile aktif olabilir.",
        code: "domain_active_manual_forbidden",
      },
      { status: 400 },
    );
  }

  try {
    const business = await updateBusinessDomainRecord(id, {
      domain: domain || hostname,
      hostname: hostname || domain,
      domainStatus: (domainStatus as
        | "pending"
        | "dns_detected"
        | "verified"
        | "ssl_ready"
        | "active"
        | "failed"
        | undefined) ?? "pending",
      verificationRequired: Boolean(body?.verificationRequired ?? false),
      verificationType: body?.verificationType ?? null,
      verificationName: body?.verificationName ?? null,
      verificationValue: body?.verificationValue ?? null,
      vercelDomainError: body?.vercelDomainError ?? null,
      dnsStatus: body?.dnsStatus ?? null,
      sslStatus: body?.sslStatus ?? null,
      appStatus: body?.appStatus ?? null,
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Domain güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
