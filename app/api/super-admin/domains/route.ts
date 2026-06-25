import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import {
  getBusinessById,
  listBusinesses,
  updateBusinessDomainRecord,
} from "@/lib/business";
import {
  removeBusinessDomainFromProvider,
  syncBusinessDomainWithProvider,
} from "@/lib/domain-provider";
import { formatDomainStatusLabel } from "@/lib/domain-utils";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const businesses = await listBusinesses();

  return NextResponse.json({
    ok: true,
    businesses,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        businessId?: string;
        action?: string;
      }
    | null;

  console.info("super-admin.domains.patch", {
    businessId: body?.businessId,
    action: body?.action,
  });

  const businessId = normalizeString(body?.businessId);
  const action = normalizeString(body?.action);

  if (!businessId) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Business ID gerekli.",
        code: "domain_business_required",
      },
      { status: 400 },
    );
  }

  const current = await getBusinessById(businessId);

  if (!current) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "Business bulunamadi.",
        code: "domain_business_not_found",
      },
      { status: 404 },
    );
  }

  if (action === "force_active") {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Force active kaldırıldı. Domain ancak gerçek provider/DNS/SSL sonucu ile aktif olabilir.",
        code: "domain_force_active_disabled",
      },
      { status: 400 },
    );
  }

  if (action === "passive") {
    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      domainStatus: "pending",
      activatedAt: null,
      lastCheckedAt: new Date().toISOString(),
      verifiedAt: null,
      sslStatus: "pending",
      appStatus: "pending",
      dnsStatus: "pending",
      verificationRequired: false,
      verificationType: null,
      verificationName: null,
      verificationValue: null,
      vercelDomainError: null,
      domainProvider: "manual",
      domainProviderStatus: "manual",
      domainProviderMessage: null,
      domainProviderSyncedAt: null,
    });

    return NextResponse.json({
      ok: true,
      business,
      message: "Domain pasif edildi.",
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  if (action === "provider_add" || action === "provider_retry") {
    const providerResult = await syncBusinessDomainWithProvider(
      current.hostname ?? current.domain ?? "",
    );

    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      domainStatus:
        providerResult.status === "provider_added"
          ? "provider_added"
          : current.domainStatus,
      domainProvider: providerResult.mode,
      domainProviderStatus: providerResult.status,
      domainProviderMessage: providerResult.message,
      domainProviderSyncedAt:
        providerResult.status === "provider_added"
          ? new Date().toISOString()
          : current.domainProviderSyncedAt,
      verificationRequired: providerResult.verification?.required ?? current.verificationRequired,
      verificationType: providerResult.verification?.type ?? current.verificationType,
      verificationName: providerResult.verification?.name ?? current.verificationName,
      verificationValue: providerResult.verification?.value ?? current.verificationValue,
      vercelDomainError:
        providerResult.error ||
        (providerResult.conflicts.length ? providerResult.conflicts.join(" | ") : null) ||
        (providerResult.misconfigured ? "Vercel domain misconfigured." : null),
    });

    return NextResponse.json({
      ok: true,
      business,
      message: providerResult.message,
      providerResult,
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  if (action === "provider_remove") {
    const providerResult = await removeBusinessDomainFromProvider(
      current.hostname ?? current.domain ?? "",
    );

    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      domainStatus: current.domainStatus,
      domainProvider: providerResult.status === "failed" ? current.domainProvider : "manual",
      domainProviderStatus: providerResult.status === "failed" ? current.domainProviderStatus : "manual",
      domainProviderMessage: providerResult.message,
      domainProviderSyncedAt: providerResult.status === "failed" ? current.domainProviderSyncedAt : null,
      vercelDomainError: providerResult.error || null,
    });

    return NextResponse.json({
      ok: true,
      business,
      message: providerResult.message,
      providerResult,
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  return NextResponse.json(
    {
      error: "validation_error",
      message: "Geçersiz işlem.",
      code: "domain_action_invalid",
    },
    { status: 400 },
  );
}
