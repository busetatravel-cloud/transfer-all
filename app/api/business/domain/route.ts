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
  formatAppStatusLabel,
  formatDnsStatusLabel,
  type DomainVerificationRecord,
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

async function checkDnsForHostname(
  hostname: string,
  verificationToken: string,
  verificationRecord?: DomainVerificationRecord | null,
) {
  const safeHostname = hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const apexHost = safeHostname.startsWith("www.")
    ? safeHostname.replace(/^www\./i, "")
    : safeHostname;
  const subHost = apexHost.startsWith("www.") ? apexHost : `www.${apexHost}`;
  const expectedARecord = "76.76.21.21";
  const expectedCname = "cname.vercel-dns.com";
  const verificationHost = verificationRecord?.name?.trim() || "_vercel";
  const expectedVerificationValue = verificationRecord?.value?.trim() || verificationToken;

  const [aRecords, cnameRecords, txtRecords, apexTxtRecords, verificationTxtRecords] = await Promise.all([
    resolve4(apexHost).catch(() => [] as string[]),
    resolveCname(subHost).catch(() => [] as string[]),
    resolveTxt(`_verify.${apexHost}`).catch(() => [] as string[][]),
    resolveTxt(apexHost).catch(() => [] as string[][]),
    resolveTxt(verificationHost).catch(() => [] as string[][]),
  ]);

  const txtValues = [
    ...flattenTxtRecords(txtRecords),
    ...flattenTxtRecords(apexTxtRecords),
    ...flattenTxtRecords(verificationTxtRecords),
  ];
  const normalizedCnames = cnameRecords.map(normalizeDnsTarget);
  const verificationSatisfied = txtValues.some((item) => item === expectedVerificationValue);
  const detected =
    aRecords.some((item) => item === expectedARecord) ||
    normalizedCnames.some((item) => item === expectedCname) ||
    verificationSatisfied;
  const verified = verificationSatisfied;

  return {
    detected,
    verified,
    verificationRequired: Boolean(verificationRecord?.required),
    verificationType: verificationRecord?.type ?? null,
    verificationName: verificationHost,
    verificationValue: verificationRecord?.value ?? null,
    aRecords,
    cnameRecords: normalizedCnames,
    txtValues,
    expectedAHost: "@",
    expectedCnameHost: "www",
    expectedARecord,
    expectedCname,
  };
}

async function checkAppReachableForHostname(hostname: string) {
  const url = `https://${hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      ok: response.status < 500,
      status: response.status,
      url,
      finalUrl: response.url,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      finalUrl: url,
      error: error instanceof Error ? error.message : "App erisimi kontrol edilemedi.",
    };
  } finally {
    clearTimeout(timeout);
  }
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

      const verificationRecord = providerSync.verification ?? null;
      const dnsCheck = await checkDnsForHostname(
        hostname,
        verificationRecord?.value ?? verificationToken,
        verificationRecord,
      );
      const sslCheck = await checkSslForHostname(hostname);
      const appCheck = await checkAppReachableForHostname(hostname);
      const verificationRequired = Boolean(
        verificationRecord?.required || providerSync.misconfigured || providerSync.conflicts.length,
      );
      const nextDnsStatus =
        dnsCheck.verified
          ? "verified"
          : dnsCheck.detected
            ? "detected"
            : "pending";
      const nextSslStatus = sslCheck.ok ? "ready" : "checking";
      const nextAppStatus = appCheck.ok ? "ready" : "checking";
      const now = new Date().toISOString();
      const nextDomainStatus: DomainStatus =
        providerSync.status === "provider_added" &&
        dnsCheck.verified &&
        sslCheck.ok &&
        appCheck.ok
        ? "active"
        : providerSync.status === "provider_added" &&
            dnsCheck.verified &&
            sslCheck.ok
          ? "ssl_ready"
          : providerSync.status === "provider_added" && dnsCheck.verified
            ? "verified"
            : providerSync.status === "provider_added" && dnsCheck.detected
              ? "dns_detected"
              : "provider_added";

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken,
        verificationRequired,
        verificationType: verificationRecord?.type ?? (verificationRequired ? "TXT" : null),
        verificationName: verificationRecord?.name ?? (verificationRequired ? "_vercel" : null),
        verificationValue: verificationRecord?.value ?? (verificationRequired ? verificationToken : null),
        vercelDomainError:
          providerSync.error ||
          (providerSync.conflicts.length ? providerSync.conflicts.join(" | ") : null) ||
          (providerSync.misconfigured ? "Vercel domain misconfigured." : null),
        domainStatus: nextDomainStatus,
        domainProvider: providerSync.mode,
        domainProviderStatus: providerSync.status,
        domainProviderMessage: providerSync.message,
        domainProviderSyncedAt: now,
        verifiedAt: dnsCheck.verified ? now : null,
        activatedAt: nextDomainStatus === "active" ? now : null,
        lastCheckedAt: now,
        dnsStatus: nextDnsStatus,
        sslStatus: nextSslStatus,
        appStatus: nextAppStatus,
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
        appCheck,
        verification: verificationRecord,
        dnsStatus: formatDnsStatusLabel(business.dnsStatus),
        appStatus: formatAppStatusLabel(business.appStatus),
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
      const providerInspection = hasVercelDomainAutomation()
        ? await inspectBusinessDomainProvider(hostname)
        : { domains: [] };
      const providerResolved = providerInspection.domains.some((item) => item.ok);
      const providerDomain = providerInspection.domains.find((item) => item.ok);
      const verificationRecord =
        providerDomain?.verification ??
        (current.verificationRequired
          ? {
              required: current.verificationRequired,
              type: current.verificationType,
              name: current.verificationName,
              value: current.verificationValue,
            }
          : null);
      const dnsCheck = await checkDnsForHostname(
        hostname,
        verificationRecord?.value ?? verificationToken,
        verificationRecord,
      );
      const appCheck = await checkAppReachableForHostname(hostname);
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
        verificationRequired: Boolean(
          verificationRecord?.required || providerDomain?.misconfigured || providerDomain?.conflicts.length,
        ),
        verificationType: verificationRecord?.type ?? (dnsCheck.verified ? "TXT" : current.verificationType),
        verificationName: verificationRecord?.name ?? (dnsCheck.verified ? "_vercel" : current.verificationName),
        verificationValue: verificationRecord?.value ?? (dnsCheck.verified ? verificationToken : current.verificationValue),
        vercelDomainError:
          providerDomain?.error ||
          (providerDomain?.conflicts.length ? providerDomain.conflicts.join(" | ") : null) ||
          (providerDomain?.misconfigured ? "Vercel domain misconfigured." : current.vercelDomainError),
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
        dnsStatus: dnsCheck.verified ? "verified" : dnsCheck.detected ? "detected" : current.dnsStatus,
        sslStatus:
          current.sslStatus === "ready" || current.sslStatus === "active"
            ? current.sslStatus
            : "checking",
        appStatus: appCheck.ok ? "ready" : "checking",
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
        appCheck,
        dnsStatus: formatDnsStatusLabel(business.dnsStatus),
        appStatus: formatAppStatusLabel(business.appStatus),
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
      const appCheck = await checkAppReachableForHostname(hostname);
      const now = new Date().toISOString();
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const nextDomainStatus: DomainStatus = sslCheck.ok
        ? currentStatus === "active" && appCheck.ok
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
        appStatus: appCheck.ok ? "ready" : "checking",
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
        appCheck,
        appStatus: formatAppStatusLabel(business.appStatus),
        warning: !sslCheck.ok,
        guideMode: !hasVercelDomainAutomation(),
      });
    }

    if (action === "check_app") {
      const current = await getBusinessById(businessId);

      if (!current || !getCurrentHostname(current)) {
        return jsonError("domain_missing", "Önce hostname kaydedin.", 400, {
          fieldErrors: { hostname: "Önce hostname kaydedin." },
        });
      }

      const hostname = getCurrentHostname(current);
      const appCheck = await checkAppReachableForHostname(hostname);
      const now = new Date().toISOString();
      const currentStatus = String(current.domainStatus ?? "").trim().toLowerCase() as DomainStatus;
      const nextDomainStatus: DomainStatus = appCheck.ok
        ? currentStatus === "active" || current.sslStatus === "ready"
          ? "active"
          : currentStatus === "ssl_ready"
            ? "ssl_ready"
            : currentStatus === "verified"
              ? "verified"
              : currentStatus === "dns_detected"
                ? "dns_detected"
                : "provider_added"
        : currentStatus === "active"
          ? "ssl_ready"
          : currentStatus;

      const business = await updateBusinessDomainRecord(businessId, {
        domain: hostname,
        hostname,
        verificationToken: current.verificationToken ?? buildDomainVerificationToken(),
        domainStatus: nextDomainStatus,
        verifiedAt: current.verifiedAt,
        activatedAt: nextDomainStatus === "active" ? current.activatedAt ?? now : current.activatedAt,
        lastCheckedAt: now,
        appStatus: appCheck.ok ? "ready" : "checking",
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
        message: appCheck.ok ? "App erişimi doğrulandı." : "App henüz erişilebilir değil.",
        statusLabel: formatDomainStatusLabel(business.domainStatus),
        appCheck,
        appStatus: formatAppStatusLabel(business.appStatus),
        warning: !appCheck.ok,
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
