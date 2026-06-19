"use client";

import { useMemo, useState } from "react";
import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";

type Channel = "mail" | "whatsapp";

type DeliveryLog = {
  id: string;
  status: string;
  messagePreview: string;
};

type Props = {
  reservation: ReservationRecord;
  voucher: BusinessVoucherRecord;
};

function buildVoucherLinkPlaceholder(voucherId: string) {
  void voucherId;
  return "{{voucher_link}}";
}

function buildMailTemplate(
  reservation: ReservationRecord,
  voucher: BusinessVoucherRecord,
  voucherLink: string,
) {
  const subject = `Rezervasyon Onayı - ${reservation.customerName}`;
  const body = [
    `Müşteri: ${reservation.customerName}`,
    `Rezervasyon No: ${voucher.documentNo}`,
    `Tarih/Saat: ${reservation.travelDate ?? "-"} ${reservation.travelTime ?? ""}`.trim(),
    `Nereden: ${reservation.origin ?? "-"}`,
    `Nereye: ${reservation.destination ?? "-"}`,
    `Voucher Link: ${voucherLink}`,
    "",
    "Saygılarımızla",
    voucher.businessName,
  ].join("\n");

  return { subject, body };
}

function buildWhatsAppTemplate(
  reservation: ReservationRecord,
  voucher: BusinessVoucherRecord,
  voucherLink: string,
) {
  return [
    `Merhaba ${reservation.customerName},`,
    "",
    `Rezervasyon No: ${voucher.documentNo}`,
    `Tarih/Saat: ${reservation.travelDate ?? "-"} ${reservation.travelTime ?? ""}`.trim(),
    `Nereden/Nereye: ${reservation.origin ?? "-"} → ${reservation.destination ?? "-"}`,
    `Voucher: ${voucherLink}`,
  ].join("\n");
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
}

async function createDeliveryLog(args: {
  reservationId: string;
  voucherId: string;
  channel: Channel;
  recipient: string;
  messagePreview: string;
  status: "draft" | "copied";
}) {
  const response = await fetch("/api/business/voucher-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      action: "create",
      section: "voucher_delivery",
      payload: {
        reservationId: args.reservationId,
        voucherId: args.voucherId,
        channel: args.channel,
        recipient: args.recipient,
        messagePreview: args.messagePreview,
        status: args.status,
      },
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "message" in body && String((body as { message?: string }).message)) ||
        "Voucher logu kaydedilemedi.",
    );
  }

  return body as { ok: true; log?: DeliveryLog };
}

export function VoucherDeliveryPanel({ reservation, voucher }: Props) {
  const voucherLink = useMemo(
    () => buildVoucherLinkPlaceholder(voucher.id),
    [voucher.id],
  );
  const [mailPreview, setMailPreview] = useState("");
  const [whatsappPreview, setWhatsAppPreview] = useState("");
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copiedState, setCopiedState] = useState<Channel | null>(null);

  async function prepareChannel(channel: Channel) {
    const mailTemplate = buildMailTemplate(reservation, voucher, voucherLink);
    const whatsappTemplate = buildWhatsAppTemplate(
      reservation,
      voucher,
      voucherLink,
    );
    const preview =
      channel === "mail"
        ? `${mailTemplate.subject}\n\n${mailTemplate.body}`
        : whatsappTemplate;

    if (channel === "mail") {
      setMailPreview(preview);
    } else {
      setWhatsAppPreview(preview);
    }

    setActiveChannel(channel);
    setStatusMessage("Taslak hazırlandı.");

    try {
      await createDeliveryLog({
        reservationId: reservation.id,
        voucherId: voucher.id,
        channel,
        recipient:
          channel === "mail"
            ? reservation.email ?? "mail-bekleniyor"
            : reservation.phone ?? "telefon-bekleniyor",
        messagePreview: preview,
        status: "draft",
      });
    } catch {
      setStatusMessage("Taslak hazırlandı, log kaydedilemedi.");
    }
  }

  async function handleCopy(channel: Channel) {
    const preview = channel === "mail" ? mailPreview : whatsappPreview;

    if (!preview.trim()) {
      setStatusMessage("Önce taslak hazırlayın.");
      return;
    }

    await copyToClipboard(preview);
    setCopiedState(channel);
    setStatusMessage("Mesaj kopyalandı.");

    try {
      await createDeliveryLog({
        reservationId: reservation.id,
        voucherId: voucher.id,
        channel,
        recipient:
          channel === "mail"
            ? reservation.email ?? "mail-bekleniyor"
            : reservation.phone ?? "telefon-bekleniyor",
        messagePreview: preview,
        status: "copied",
      });
    } catch {
      setStatusMessage("Mesaj kopyalandı, log kaydedilemedi.");
    }
  }

  return (
    <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-1">
        <div className="text-sm font-semibold text-slate-950">Gönderim hazırlığı</div>
        <p className="text-sm leading-6 text-slate-500">
          Gerçek gönderim yok. Sadece şablon ve log oluşturulur.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => void prepareChannel("mail")}
        >
          Mail hazırla
        </button>
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => void prepareChannel("whatsapp")}
        >
          WhatsApp mesajı hazırla
        </button>
      </div>

      {statusMessage ? (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">Mail önizleme</div>
            <button
              className="text-xs font-semibold text-slate-600 transition hover:text-slate-950"
              type="button"
              onClick={() => void handleCopy("mail")}
            >
              Kopyala
            </button>
          </div>
          <textarea
            className="min-h-56 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
            readOnly
            value={
              mailPreview ||
              "Mail hazırla butonuna basın. Müşteri adı, rezervasyon no, tarih/saat, nereden/nereye ve voucher link burada görünecek."
            }
          />
          {copiedState === "mail" ? (
            <div className="text-xs uppercase tracking-[0.22em] text-emerald-600">
              Mail kopyalandı
            </div>
          ) : null}
        </article>

        <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">WhatsApp önizleme</div>
            <button
              className="text-xs font-semibold text-slate-600 transition hover:text-slate-950"
              type="button"
              onClick={() => void handleCopy("whatsapp")}
            >
              Kopyala
            </button>
          </div>
          <textarea
            className="min-h-56 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
            readOnly
            value={
              whatsappPreview ||
              "WhatsApp mesajı hazırla butonuna basın. Müşteri adı, rezervasyon no, tarih/saat, nereden/nereye ve voucher link burada görünecek."
            }
          />
          {copiedState === "whatsapp" ? (
            <div className="text-xs uppercase tracking-[0.22em] text-emerald-600">
              WhatsApp kopyalandı
            </div>
          ) : null}
        </article>
      </div>

      {activeChannel ? (
        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Kayıt türü: {activeChannel === "mail" ? "Mail" : "WhatsApp"} | Voucher bağlantı
          yer tutucu: {voucherLink}
        </div>
      ) : null}
    </section>
  );
}
