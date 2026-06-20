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
    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      domainStatus: "active",
      verifiedAt: current.verifiedAt ?? new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      sslStatus: "active",
    });

    return NextResponse.json({
      ok: true,
      business,
      message: "Domain aktif edildi.",
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  if (action === "passive") {
    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      domainStatus: current.hostname || current.domain ? "verified" : "pending",
      activatedAt: null,
      lastCheckedAt: new Date().toISOString(),
      sslStatus: "pending",
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
      domainProvider: "manual",
      domainProviderStatus: "manual",
      domainProviderMessage: providerResult.message,
      domainProviderSyncedAt: null,
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
