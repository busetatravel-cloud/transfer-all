"use client";

import { useMemo, useState } from "react";
import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";
import {
  buildVoucherLinkPlaceholder,
  buildVoucherMailTemplate,
} from "@/lib/voucher-mail";
import { buildVoucherWhatsAppTemplate } from "@/lib/voucher-whatsapp";

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
  status: "draft" | "copied" | "sent_placeholder" | "sent" | "failed";
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

  const body = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        log?: DeliveryLog;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.message || "Voucher logu kaydedilemedi.");
  }

  return body as { ok: true; log?: DeliveryLog };
}

async function sendMail(args: {
  reservationId: string;
  voucherId: string;
  recipient: string;
  messagePreview: string;
}) {
  const response = await fetch("/api/business/voucher-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      action: "send",
      section: "voucher_delivery",
      payload: {
        reservationId: args.reservationId,
        voucherId: args.voucherId,
        channel: "mail",
        recipient: args.recipient,
        messagePreview: args.messagePreview,
        status: "draft",
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        log?: DeliveryLog;
        provider?: string;
        status?: string;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.message || "Mail gönderilemedi.");
  }

  return body as { ok: true; log?: DeliveryLog; provider?: string; status?: string };
}

async function sendWhatsApp(args: {
  reservationId: string;
  voucherId: string;
  recipient: string;
  messagePreview: string;
}) {
  const response = await fetch("/api/business/voucher-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      action: "send",
      section: "voucher_delivery",
      payload: {
        reservationId: args.reservationId,
        voucherId: args.voucherId,
        channel: "whatsapp",
        recipient: args.recipient,
        messagePreview: args.messagePreview,
        status: "draft",
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        log?: DeliveryLog;
        provider?: string;
        status?: string;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.message || "WhatsApp gönderilemedi.");
  }

  return body as { ok: true; log?: DeliveryLog; provider?: string; status?: string };
}

export function VoucherDeliveryPanel({ reservation, voucher }: Props) {
  const voucherLink = useMemo(
    () => buildVoucherLinkPlaceholder(voucher.id),
    [voucher.id],
  );
  const mailTemplate = useMemo(
    () =>
      buildVoucherMailTemplate(reservation, voucher, {
        voucherLink,
        businessName: voucher.businessName,
      }),
    [reservation, voucher, voucherLink],
  );
  const whatsappTemplate = useMemo(
    () =>
      buildVoucherWhatsAppTemplate(reservation, voucher, {
        voucherLink,
        businessName: voucher.businessName,
      }),
    [reservation, voucher, voucherLink],
  );

  const [mailPreview, setMailPreview] = useState("");
  const [whatsappPreview, setWhatsAppPreview] = useState("");
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copiedState, setCopiedState] = useState<Channel | null>(null);
  const [sendingMail, setSendingMail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  async function prepareChannel(channel: Channel) {
    const preview = channel === "mail" ? mailTemplate.preview : whatsappTemplate.preview;

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
            ? mailTemplate.recipient || "mail-bekleniyor"
            : whatsappTemplate.recipient || "telefon-bekleniyor",
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
            ? mailTemplate.recipient || "mail-bekleniyor"
            : whatsappTemplate.recipient || "telefon-bekleniyor",
        messagePreview: preview,
        status: "copied",
      });
    } catch {
      setStatusMessage("Mesaj kopyalandı, log kaydedilemedi.");
    }
  }

  async function handleSendMail() {
    if (sendingMail) {
      return;
    }

    const preview = mailPreview.trim() ? mailPreview : mailTemplate.preview;
    const recipient = mailTemplate.recipient;

    if (!recipient) {
      setStatusMessage("Mail göndermek için müşteri emaili gerekli.");
      try {
        await createDeliveryLog({
          reservationId: reservation.id,
          voucherId: voucher.id,
          channel: "mail",
          recipient: "",
          messagePreview: preview,
          status: "failed",
        });
      } catch {
        // ignore log errors
      }
      return;
    }

    setSendingMail(true);
    setStatusMessage("Mail gönderiliyor...");

    try {
      const result = await sendMail({
        reservationId: reservation.id,
        voucherId: voucher.id,
        recipient,
        messagePreview: preview,
      });

      setActiveChannel("mail");
      setMailPreview(preview);
      setStatusMessage(
        result.status === "sent"
          ? "Mail gönderildi."
          : "Mail gönderim hazırlığı tamamlandı.",
      );
      setCopiedState(null);
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message ? error.message : "Mail gönderilemedi.",
      );
    } finally {
      setSendingMail(false);
    }
  }

  async function handleSendWhatsApp() {
    if (sendingWhatsApp) {
      return;
    }

    const preview = whatsappPreview.trim() ? whatsappPreview : whatsappTemplate.preview;
    const recipient = whatsappTemplate.recipient;

    if (!recipient) {
      setStatusMessage("WhatsApp göndermek için müşteri telefonu gerekli.");
      try {
        await createDeliveryLog({
          reservationId: reservation.id,
          voucherId: voucher.id,
          channel: "whatsapp",
          recipient: "",
          messagePreview: preview,
          status: "failed",
        });
      } catch {
        // ignore log errors
      }
      return;
    }

    setSendingWhatsApp(true);
    setStatusMessage("WhatsApp gönderiliyor...");

    try {
      const result = await sendWhatsApp({
        reservationId: reservation.id,
        voucherId: voucher.id,
        recipient,
        messagePreview: preview,
      });

      setActiveChannel("whatsapp");
      setWhatsAppPreview(preview);
      setStatusMessage(
        result.status === "sent"
          ? "WhatsApp gönderildi."
          : "WhatsApp gönderim hazırlığı tamamlandı.",
      );
      setCopiedState(null);
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message
          ? error.message
          : "WhatsApp gönderilemedi.",
      );
    } finally {
      setSendingWhatsApp(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-1">
        <div className="text-sm font-semibold text-slate-950">Gönderim hazırlığı</div>
        <p className="text-sm leading-6 text-slate-500">
          Gerçek gönderim, provider env varsa denenir. Aksi halde placeholder log yazılır.
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
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          disabled={sendingMail}
          onClick={() => void handleSendMail()}
        >
          Mail Gönder
        </button>
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => void prepareChannel("whatsapp")}
        >
          WhatsApp mesajı hazırla
        </button>
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-700 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          disabled={sendingWhatsApp}
          onClick={() => void handleSendWhatsApp()}
        >
          WhatsApp Gönder
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
              "WhatsApp mesajı hazırla butonuna basın. Müşteri telefonu, rezervasyon no, tarih/saat, nereden/nereye ve voucher link burada görünecek."
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
