import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  getBusinessById,
  updateBusinessDomainRecord,
  updateBusinessOwnDomainRecord,
} from "@/lib/business";
import { buildDomainVerificationToken, formatDomainStatusLabel } from "@/lib/domain-utils";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const business = await getBusinessById(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    business,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        hostname?: string;
      }
    | null;

  console.info("business.domain.patch", {
    businessId: auth.session.businessId,
    action: body?.action,
    hostname: body?.hostname,
  });

  const action = normalizeString(body?.action);
  const businessId = auth.session.businessId;

  if (action === "save") {
    const hostname = normalizeString(body?.hostname);

    if (!hostname) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Hostname gerekli.",
          code: "domain_hostname_required",
          fieldErrors: { hostname: "Hostname gerekli." },
        },
        { status: 400 },
      );
    }

    const current = await getBusinessById(businessId);
    const verificationToken =
      current?.verificationToken ?? buildDomainVerificationToken();

    const business = await updateBusinessDomainRecord(businessId, {
      domain: hostname,
      hostname,
      verificationToken,
      domainStatus: "dns_detected",
      verifiedAt: null,
      activatedAt: null,
      lastCheckedAt: new Date().toISOString(),
      sslStatus: "pending",
    });

    await recordAuditLog({
      businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "domain",
      entityId: businessId,
      action: "update",
      before: current,
      after: business,
    });

    return NextResponse.json({
      ok: true,
      business,
      message: "Domain kaydedildi.",
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  if (action === "verify") {
    const current = await getBusinessById(businessId);

    if (!current || !(current.hostname ?? current.domain)) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Önce hostname kaydedin.",
          code: "domain_missing",
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        },
        { status: 400 },
      );
    }

    const business = await updateBusinessDomainRecord(businessId, {
      domain: current.hostname ?? current.domain ?? "",
      hostname: current.hostname ?? current.domain ?? "",
      verificationToken: current.verificationToken ?? buildDomainVerificationToken(),
      domainStatus: "verified",
      verifiedAt: current.verifiedAt ?? new Date().toISOString(),
      activatedAt: current.activatedAt ?? null,
      lastCheckedAt: new Date().toISOString(),
      sslStatus: "issued",
    });

    await recordAuditLog({
      businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "domain",
      entityId: businessId,
      action: "update",
      before: current,
      after: business,
    });

    return NextResponse.json({
      ok: true,
      business,
      message: "Domain doğrulandı.",
      statusLabel: formatDomainStatusLabel(business.domainStatus),
    });
  }

  if (action === "remove") {
    const current = await getBusinessById(businessId);
    const business = await updateBusinessOwnDomainRecord(businessId, "");

    await recordAuditLog({
      businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "domain",
      entityId: businessId,
      action: "delete",
      before: current,
      after: business,
    });

    return NextResponse.json({
      ok: true,
      business,
      message: "Domain kaldırıldı.",
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
