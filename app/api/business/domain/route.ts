import { NextResponse } from "next/server";
import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import tls from "node:tls";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  getBusinessByDomain,
  getBusinessById,
  updateBusinessDomainRecord,
  updateBusinessOwnDomainRecord,
} from "@/lib/business";
import {
  buildDomainVerificationToken,
  formatDomainStatusLabel,
  type DomainStatus,
} from "@/lib/domain-utils";
import {
  getDomainAutomationMode,
  hasVercelDomainAutomation,
  inspectBusinessDomainProvider,
  removeBusinessDomainFromProvider,
  syncBusinessDomainWithProvider,
} from "@/lib/domain-provider";
import { normalizeDomain } from "@/lib/platform";

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

function isProtectedDomainStatus(status: DomainStatus | string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "ssl_ready" || normalized === "verified";
}

function getGuideModeMessage() {
  return "Production hedef domain/IP ayarlanmadı. Bu ekran rehber modunda çalışır.";
}

function getCurrentHostname(current: { hostname?: string | null; domain?: string | null }) {
  return (current.hostname ?? current.domain ?? "").trim();
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
    providerMode: getDomainAutomationMode(),
  });

  try {
    if (action === "save") {
      const hostname = normalizeDomain(normalizeString(body?.hostname));

      if (!hostname) {
        return jsonError("domain_hostname_required", "Hostname gerekli.", 400, {
          fieldErrors: { hostname: "Hostname gerekli." },
        });
      }

      const current = await getBusinessById(businessId);
      const duplicate = await getBusinessByDomain(hostname);

      if (duplicate && duplicate.id !== businessId) {
        return jsonError("domain_duplicate", "Bu domain zaten kullanılıyor.", 409, {
          fieldErrors: { hostname: "Bu domain zaten kullanılıyor." },
        });
      }

      if (!hasVercelDomainAutomation()) {
        return jsonError(
          "vercel_connection_missing",
          "Vercel bağlantısı eksik. VERCEL_API_TOKEN ve VERCEL_PROJECT_ID gerekli.",
          503,
          {
            fieldErrors: { hostname: "Vercel bağlantısı eksik." },
            providerStatus: "manual",
          },
        );
      }

      const verificationToken =
        current?.verificationToken ?? buildDomainVerificationToken();
      const providerSync = await syncBusinessDomainWithProvider(hostname);

      console.info("business.domain.provider.sync", {
        businessId,
        hostname,
        providerStatus: providerSync.status,
        providerMode: providerSync.mode,
        domains: providerSync.domains,
      });

      if (providerSync.status !== "provider_added") {
        return jsonError(
          "provider_sync_failed",
          providerSync.message || "Vercel domain eklenemedi.",
          502,
          {
            providerStatus: providerSync.status,
            providerMode: providerSync.mode,
          },
        );
      }

      const dnsCheck = await checkDnsForHostname(hostname, verificationToken);
      const sslCheck = await checkSslForHostname(hostname);
      const now = new Date().toISOString();
      const nextDomainStatus: DomainStatus = sslCheck.ok && dnsCheck.verified
        ? "active"
        : sslCheck.ok
          ? "ssl_ready"
          : dnsCheck.verified
            ? "verified"
            : dnsCheck.detected
              ? "dns_detected"
              : "provider_added";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        domainStatus: nextDomainStatus,
        domainProvider: providerSync.mode,
        domainProviderStatus: providerSync.status,
        domainProviderMessage: providerSync.message,
        domainProviderSyncedAt: now,
        verifiedAt: dnsCheck.verified ? now : null,
        activatedAt: nextDomainStatus === "active" ? now : null,
        lastCheckedAt: now,
        sslStatus: sslCheck.ok ? "ready" : "checking",
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
        message: providerSync.message,
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        providerStatus: providerSync.status,
        providerMode: providerSync.mode,
        dnsCheck,
        sslCheck,
        warning: nextDomainStatus !== "active",
      });
    }

    if (action === "check_dns" || action === "verify") {
      const current = await getBusinessById(businessId);

      if (!current || !getCurrentHostname(current)) {
        return jsonError("domain_missing", "Önce hostname kaydedin.", 400, {
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        });
      }

      const hostname = getCurrentHostname(current);
      const verificationToken = current.verificationToken ?? buildDomainVerificationToken();
      const dnsCheck = await checkDnsForHostname(hostname, verificationToken);
      const providerInspection = hasVercelDomainAutomation()
        ? await inspectBusinessDomainProvider(hostname)
        : { domains: [] };
      const providerResolved = providerInspection.domains.some((item) => item.ok);
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const nextStatus: DomainStatus =
        isProtectedDomainStatus(currentStatus)
          ? currentStatus
          : dnsCheck.verified
            ? "verified"
            : dnsCheck.detected
              ? "dns_detected"
              : providerResolved
                ? "provider_added"
                : currentStatus === "provider_added"
                  ? "provider_added"
                  : "pending";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        domainStatus: nextStatus,
        domainProvider: providerResolved ? "vercel" : current.domainProvider,
        domainProviderStatus: providerResolved ? "provider_added" : current.domainProviderStatus,
        domainProviderMessage: providerResolved
          ? "Vercel domain kaydı doğrulandı."
          : current.domainProviderMessage,
        domainProviderSyncedAt: current.domainProviderSyncedAt,
        verifiedAt: dnsCheck.verified ? current.verifiedAt ?? new Date().toISOString() : current.verifiedAt,
        activatedAt: current.activatedAt ?? null,
        lastCheckedAt: new Date().toISOString(),
        sslStatus:
          current.sslStatus === "ready" || current.sslStatus === "active"
            ? current.sslStatus
            : "checking",
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
        providerCheck: providerInspection,
        warning: !hasVercelDomainAutomation(),
        guideMode: !hasVercelDomainAutomation(),
      });
    }

    if (action === "check_ssl") {
      const current = await getBusinessById(businessId);

      if (!current || !getCurrentHostname(current)) {
        return jsonError("domain_missing", "Önce hostname kaydedin.", 400, {
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        });
      }

      const hostname = getCurrentHostname(current);
      const sslCheck = await checkSslForHostname(hostname);
      const now = new Date().toISOString();
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const nextDomainStatus: DomainStatus = sslCheck.ok
        ? currentStatus === "active"
          ? "active"
          : "ssl_ready"
        : isProtectedDomainStatus(currentStatus)
          ? currentStatus
          : currentStatus === "provider_added"
            ? "provider_added"
            : currentStatus === "dns_detected"
              ? "dns_detected"
              : currentStatus === "verified"
                ? "verified"
                : "pending";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken: current.verificationToken ?? buildDomainVerificationToken(),
        domainStatus: nextDomainStatus,
        verifiedAt: current.verifiedAt ?? (sslCheck.ok ? now : null),
        activatedAt: nextDomainStatus === "active" ? current.activatedAt ?? now : null,
        lastCheckedAt: now,
        sslStatus: sslCheck.ok ? "ready" : current.sslStatus === "ready" || current.sslStatus === "active" ? current.sslStatus : "checking",
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
        warning: !sslCheck.ok,
        guideMode: !hasVercelDomainAutomation(),
      });
    }

    if (action === "remove") {
      const current = await getBusinessById(businessId);
      const providerRemoval = await removeBusinessDomainFromProvider(getCurrentHostname(current ?? {}));
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
        message: providerRemoval.message,
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        providerRemoval,
      });
    }

    return jsonError("domain_action_invalid", "Geçersiz işlem.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Domain işlemi başarısız.";
    const status =
      /Vercel bağlantısı eksik/i.test(message)
        ? 503
        : /already exists|başka bir business|kullanılıyor|validasyon/i.test(message)
        ? 409
        : /bulunamadı|required|gerekli/i.test(message)
          ? 422
          : /provider|Vercel/i.test(message)
            ? 502
            : 400;
    return jsonError("domain_operation_failed", message, status);
  }
}
