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

async function checkDnsForHostname(hostname: string, verificationToken: string) {
  const safeHostname = hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const apexHost = safeHostname.startsWith("www.") ? safeHostname.replace(/^www\./i, "") : safeHostname;
  const subHost = apexHost.startsWith("www.") ? apexHost : `www.${apexHost}`;

  const [aRecords, cnameRecords, txtRecords, apexTxtRecords] = await Promise.all([
    resolve4(safeHostname).catch(() => [] as string[]),
    resolveCname(safeHostname).catch(() => [] as string[]),
    resolveTxt(`_verify.${apexHost}`).catch(() => [] as string[][]),
    resolveTxt(safeHostname).catch(() => [] as string[][]),
  ]);

  const txtValues = [...flattenTxtRecords(txtRecords), ...flattenTxtRecords(apexTxtRecords)];
  const detected = aRecords.length > 0 || cnameRecords.length > 0;
  const verified = txtValues.some((item) => item === verificationToken);

  return {
    detected,
    verified,
    aRecords,
    cnameRecords,
    txtValues,
    expectedAHost: apexHost === safeHostname ? "@" : apexHost,
    expectedCnameHost: subHost,
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

      const nextStatus: DomainStatus = dnsCheck.verified
        ? "verified"
        : dnsCheck.detected
          ? "dns_detected"
          : "failed";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        domainStatus: nextStatus,
        verifiedAt: dnsCheck.verified ? current.verifiedAt ?? new Date().toISOString() : current.verifiedAt,
        activatedAt: current.activatedAt ?? null,
        lastCheckedAt: new Date().toISOString(),
        sslStatus: current.sslStatus === "active" ? "active" : "pending",
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
            : "DNS kaydı bulunamadı.",
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        dnsCheck,
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

      const isVerified = current.domainStatus === "verified" || current.domainStatus === "ssl_ready" || current.domainStatus === "active";
      const nextDomainStatus: DomainStatus = sslCheck.ok
        ? isVerified
          ? "active"
          : "ssl_ready"
        : current.domainStatus === "active"
          ? "failed"
          : current.domainStatus;

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken: current.verificationToken ?? buildDomainVerificationToken(),
        domainStatus: nextDomainStatus,
        verifiedAt: current.verifiedAt ?? (isVerified ? now : null),
        activatedAt: nextDomainStatus === "active" ? current.activatedAt ?? now : current.activatedAt,
        lastCheckedAt: now,
        sslStatus: sslCheck.ok ? "active" : "failed",
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
        message: sslCheck.ok ? "SSL kontrolü başarılı." : "SSL sertifikası doğrulanamadı.",
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        sslCheck,
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
