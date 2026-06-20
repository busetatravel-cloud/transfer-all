import { NextResponse } from "next/server";
import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import tls from "node:tls";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  getBusinessById,
  updateBusinessDomainRecord,
  updateBusinessOwnDomainRecord,
} from "@/lib/business";
import {
  buildDomainVerificationToken,
  formatDomainStatusLabel,
  hasProductionTargetDomain,
  type DomainStatus,
} from "@/lib/domain-utils";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      ...(extra ?? {}),
    },
    { status },
  );
}

async function readBody(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

function flattenTxtRecords(records: string[][]) {
  return records
    .map((record) => record.join(""))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDnsTarget(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function isWarningDomainStatus(status: DomainStatus | string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "ssl_ready" || normalized === "verified";
}

function getGuideModeMessage() {
  return "Production hedef domain/IP ayarlanmadı. Bu ekran rehber modunda çalışır.";
}

async function checkDnsForHostname(hostname: string, verificationToken: string) {
  const safeHostname = hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const apexHost = safeHostname.startsWith("www.")
    ? safeHostname.replace(/^www\./i, "")
    : safeHostname;
  const subHost = apexHost.startsWith("www.") ? apexHost : `www.${apexHost}`;
  const expectedARecord = "76.76.21.21";
  const expectedCname = "cname.vercel-dns.com";

  const [aRecords, cnameRecords, txtRecords, apexTxtRecords] = await Promise.all([
    resolve4(apexHost).catch(() => [] as string[]),
    resolveCname(subHost).catch(() => [] as string[]),
    resolveTxt(`_verify.${apexHost}`).catch(() => [] as string[][]),
    resolveTxt(apexHost).catch(() => [] as string[][]),
  ]);

  const txtValues = [...flattenTxtRecords(txtRecords), ...flattenTxtRecords(apexTxtRecords)];
  const normalizedCnames = cnameRecords.map(normalizeDnsTarget);
  const detected =
    aRecords.some((item) => item === expectedARecord) ||
    normalizedCnames.some((item) => item === expectedCname) ||
    txtValues.some((item) => item === verificationToken);
  const verified = txtValues.some((item) => item === verificationToken);

  return {
    detected,
    verified,
    aRecords,
    cnameRecords: normalizedCnames,
    txtValues,
    expectedAHost: "@",
    expectedCnameHost: "www",
    expectedARecord,
    expectedCname,
  };
}

async function checkSslForHostname(hostname: string) {
  return await new Promise<{
    ok: boolean;
    issuer?: string;
    validTo?: string;
    error?: string;
  }>((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const validTo = typeof cert?.valid_to === "string" ? cert.valid_to : undefined;
          const issuer = cert?.issuer ? JSON.stringify(cert.issuer) : undefined;
          const expired = validTo ? new Date(validTo).getTime() < Date.now() : false;
          resolve({
            ok: Boolean(cert && Object.keys(cert).length > 0 && !expired),
            issuer,
            validTo,
          });
        } catch (error) {
          resolve({
            ok: false,
            error: error instanceof Error ? error.message : "SSL kontrolü yapılamadı.",
          });
        } finally {
          socket.end();
        }
      },
    );

    socket.on("error", (error) => {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "SSL kontrolü yapılamadı.",
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        ok: false,
        error: "SSL kontrolü zaman aşımına uğradı.",
      });
    });
  });
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return jsonError("unauthorized", auth.error, auth.status);
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
    return jsonError("unauthorized", auth.error, auth.status);
  }

  const body = await readBody(request);
  const action = normalizeString(body?.action);
  const businessId = auth.session.businessId;

  console.info("business.domain.patch", {
    businessId,
    action,
    hostname: body?.hostname,
  });

  try {
    if (action === "save") {
      const hostname = normalizeString(body?.hostname);

      if (!hostname) {
        return jsonError("domain_hostname_required", "Hostname gerekli.", 400, {
          fieldErrors: { hostname: "Hostname gerekli." },
        });
      }

      const current = await getBusinessById(businessId);
      const verificationToken =
        current?.verificationToken ?? buildDomainVerificationToken();

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        domainStatus: "pending",
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

    if (action === "check_dns" || action === "verify") {
      const current = await getBusinessById(businessId);

      if (!current || !(current.hostname ?? current.domain)) {
        return jsonError("domain_missing", "Önce hostname kaydedin.", 400, {
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        });
      }

      const hostname = (current.hostname ?? current.domain ?? "").trim();
      const verificationToken = current.verificationToken ?? buildDomainVerificationToken();
      const dnsCheck = await checkDnsForHostname(hostname, verificationToken);
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const preserveStatus = isWarningDomainStatus(currentStatus) ? currentStatus : null;
      const productionTargetReady = hasProductionTargetDomain();
      const nextStatus: DomainStatus = preserveStatus
        ? preserveStatus
        : productionTargetReady
          ? dnsCheck.verified
            ? "verified"
            : dnsCheck.detected
              ? "dns_detected"
              : "pending"
          : dnsCheck.verified
            ? "verified"
            : dnsCheck.detected
              ? "dns_detected"
              : "pending";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        domainStatus: nextStatus,
        verifiedAt: dnsCheck.verified ? current.verifiedAt ?? new Date().toISOString() : current.verifiedAt,
        activatedAt: current.activatedAt ?? null,
        lastCheckedAt: new Date().toISOString(),
        sslStatus: current.sslStatus === "ready" || current.sslStatus === "active" ? current.sslStatus : "checking",
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
        message: dnsCheck.verified
          ? "DNS doğrulandı."
          : dnsCheck.detected
            ? "DNS kaydı algılandı."
            : getGuideModeMessage(),
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        dnsCheck,
        warning: !productionTargetReady,
        guideMode: !productionTargetReady,
      });
    }

    if (action === "check_ssl") {
      const current = await getBusinessById(businessId);

      if (!current || !(current.hostname ?? current.domain)) {
        return jsonError("domain_missing", "Önce hostname kaydedin.", 400, {
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        });
      }

      const hostname = (current.hostname ?? current.domain ?? "").trim();
      const sslCheck = await checkSslForHostname(hostname);
      const now = new Date().toISOString();
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const preserveStatus = isWarningDomainStatus(currentStatus) ? currentStatus : null;
      const productionTargetReady = hasProductionTargetDomain();
      const nextDomainStatus: DomainStatus = sslCheck.ok
        ? currentStatus === "active"
          ? "active"
          : productionTargetReady
            ? "ssl_ready"
            : currentStatus
        : preserveStatus ?? currentStatus ?? "pending";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken: current.verificationToken ?? buildDomainVerificationToken(),
        domainStatus: nextDomainStatus,
        verifiedAt: current.verifiedAt ?? (sslCheck.ok ? now : null),
        activatedAt: nextDomainStatus === "active" ? current.activatedAt ?? now : current.activatedAt,
        lastCheckedAt: now,
        sslStatus: productionTargetReady && sslCheck.ok ? "ready" : "checking",
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
        message: sslCheck.ok ? "SSL sertifikası hazır." : "SSL sertifikası henüz hazır değil.",
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        sslCheck,
        warning: !productionTargetReady || !sslCheck.ok,
        guideMode: !productionTargetReady,
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

    return jsonError("domain_action_invalid", "Geçersiz işlem.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Domain işlemi başarısız.";
    const status =
      /already exists|başka bir business|kullanılıyor|validasyon/i.test(message)
        ? 409
        : /bulunamadı|required|gerekli/i.test(message)
          ? 422
          : 400;
    return jsonError("domain_operation_failed", message, status);
  }
}
