import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getBusinessPanelData } from "@/lib/business-panel";
import { sendVoucherMail } from "@/lib/mail";
import { sendVoucherWhatsApp } from "@/lib/whatsapp";
import { getReservationById } from "@/lib/reservation-service";
import {
  buildVoucherLinkPlaceholder,
  buildVoucherMailTemplate,
} from "@/lib/voucher-mail";
import { buildVoucherWhatsAppTemplate } from "@/lib/voucher-whatsapp";
import {
  ensureBusinessVoucherForReservation,
  getBusinessVoucherByRequestId,
} from "@/lib/vouchers";
import { createVoucherDeliveryLog } from "@/lib/voucher-delivery";
import { getLocalizedPublicSiteData } from "@/lib/public-localization";
import { normalizeLanguageCode } from "@/lib/languages";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBodyField(body: Record<string, unknown> | null, key: string) {
  if (!body) {
    return undefined;
  }

  const payload = body.payload as Record<string, unknown> | undefined;
  return payload?.[key] ?? body[key];
}

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
  error?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      ...(extra ?? {}),
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status },
  );
}

async function buildReservationContext(businessId: string, reservationId: string) {
  const reservation = await getReservationById(businessId, reservationId);

  if (!reservation) {
    return null;
  }

  const voucher =
    (await getBusinessVoucherByRequestId(businessId, reservationId)) ??
    (await ensureBusinessVoucherForReservation(businessId, reservationId));

  if (!voucher) {
    return null;
  }

  return { reservation, voucher };
}

async function writeDeliveryLog(args: {
  businessId: string;
  reservationId: string;
  voucherId: string;
  channel: "mail" | "whatsapp";
  recipient: string;
  status: "draft" | "copied" | "sent_placeholder" | "sent" | "failed";
  messagePreview: string;
}) {
  return createVoucherDeliveryLog(args);
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const action = normalizeText(parseBodyField(body, "action")) || "create";
  const reservationId = normalizeText(parseBodyField(body, "reservationId"));
  const voucherId = normalizeText(parseBodyField(body, "voucherId"));
  const channel = normalizeText(parseBodyField(body, "channel")) as
    | "mail"
    | "whatsapp";
  const recipient = normalizeText(parseBodyField(body, "recipient"));
  const messagePreview = normalizeText(parseBodyField(body, "messagePreview"));
  const status = normalizeText(parseBodyField(body, "status")) || "draft";

  if (!reservationId || !voucherId || !channel) {
    return buildErrorResponse(400, "validation_error", "Zorunlu alanlar eksik.");
  }

  const context = await buildReservationContext(
    auth.session.businessId,
    reservationId,
  );

  if (!context || context.voucher.id !== voucherId) {
    return buildErrorResponse(404, "not_found", "Voucher bulunamadı.");
  }

  const panel = await getBusinessPanelData(auth.session.businessId);
  const preferredLocale =
    normalizeLanguageCode(context.voucher.language) ??
    normalizeLanguageCode(context.reservation.language) ??
    normalizeLanguageCode(panel.seo.defaultLocale) ??
    "tr";
  const localization = await getLocalizedPublicSiteData(panel, preferredLocale);

  const mailTemplate = buildVoucherMailTemplate(context.reservation, context.voucher, {
    voucherLink: buildVoucherLinkPlaceholder(context.voucher.id),
    businessName: context.voucher.businessName,
    copy: localization?.copy.voucher,
  });
  const whatsappTemplate = buildVoucherWhatsAppTemplate(
    context.reservation,
    context.voucher,
    {
      voucherLink: buildVoucherLinkPlaceholder(context.voucher.id),
      businessName: context.voucher.businessName,
      copy: localization?.copy.voucher,
    },
  );

  if (action === "send" && channel === "mail") {
    const recipientEmail = recipient || mailTemplate.recipient;

    if (!recipientEmail) {
      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: "",
        status: "failed",
        messagePreview: messagePreview || mailTemplate.preview,
      });

      return NextResponse.json({
        ok: false,
        code: "validation_error",
        message: "Mail alıcı adresi gerekli.",
        log,
      });
    }

    try {
      const result = await sendVoucherMail({
        to: recipientEmail,
        subject: mailTemplate.subject,
        text: mailTemplate.preview,
      });

      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: recipientEmail,
        status: result.status,
        messagePreview: mailTemplate.preview,
      });

      return NextResponse.json({
        ok: true,
        provider: result.provider,
        status: result.status,
        log,
      });
    } catch (error) {
      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: recipientEmail,
        status: "failed",
        messagePreview: mailTemplate.preview,
      });

      return buildErrorResponse(
        500,
        "send_failed",
        error instanceof Error ? error.message : "Mail gönderilemedi.",
        { log },
        error,
      );
    }
  }

  if (action === "send" && channel === "whatsapp") {
    const recipientPhone = recipient || whatsappTemplate.recipient;

    if (!recipientPhone) {
      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: "",
        status: "failed",
        messagePreview: messagePreview || whatsappTemplate.preview,
      });

      return NextResponse.json({
        ok: false,
        code: "validation_error",
        message: "WhatsApp alıcı telefonu gerekli.",
        log,
      });
    }

    try {
      const result = await sendVoucherWhatsApp({
        to: recipientPhone,
        body: whatsappTemplate.preview,
      });

      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: recipientPhone,
        status: result.status,
        messagePreview: whatsappTemplate.preview,
      });

      return NextResponse.json({
        ok: true,
        provider: result.provider,
        status: result.status,
        log,
      });
    } catch (error) {
      const log = await writeDeliveryLog({
        businessId: auth.session.businessId,
        reservationId,
        voucherId,
        channel,
        recipient: recipientPhone,
        status: "failed",
        messagePreview: whatsappTemplate.preview,
      });

      return buildErrorResponse(
        500,
        "send_failed",
        error instanceof Error ? error.message : "WhatsApp gönderilemedi.",
        { log },
        error,
      );
    }
  }

  try {
    const preview =
      channel === "whatsapp"
        ? messagePreview || whatsappTemplate.preview
        : messagePreview || mailTemplate.preview;

    const log = await writeDeliveryLog({
      businessId: auth.session.businessId,
      reservationId,
      voucherId,
      channel,
      recipient,
      status:
        status === "copied" ||
        status === "sent" ||
        status === "sent_placeholder" ||
        status === "failed"
          ? status
          : "draft",
      messagePreview: preview,
    });

    return NextResponse.json({
      ok: true,
      log,
    });
  } catch (error) {
    return buildErrorResponse(
      500,
      "log_failed",
      error instanceof Error ? error.message : "Voucher log kaydedilemedi.",
      undefined,
      error,
    );
  }
}
