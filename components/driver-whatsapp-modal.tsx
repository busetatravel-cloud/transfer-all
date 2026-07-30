"use client";

import { useEffect, useRef, useState } from "react";
import type { OperationReservationRecord } from "@/lib/operation-types";
import {
  DRIVER_TASK_FIELD_DEFINITIONS,
  buildDriverTaskMessage,
  createDefaultDriverTaskSelection,
  createDriverTaskSelection,
  type DriverTaskFieldKey,
  type DriverTaskFieldSelection,
} from "@/lib/driver-task-message";

type SendState = {
  status: "idle" | "sending" | "success" | "error";
  message: string;
};

function mapErrorCodeToMessage(code: string | undefined) {
  switch (code) {
    case "driver_not_assigned":
      return "Bu rezervasyona şoför atanmamış.";
    case "driver_phone_missing":
      return "Atanan şoförün telefon numarası bulunmuyor.";
    case "reservation_not_found":
    case "not_found":
      return "Rezervasyon bulunamadı.";
    case "empty_message":
      return "Gönderilecek en az bir alan seçmelisiniz ve seçilen alanların verisi dolu olmalı.";
    case "invalid_driver_phone":
      return "Şoförün telefon numarası uluslararası formatta değil. Örnek: +905551112233";
    default:
      return "WhatsApp mesajı gönderilemedi. Lütfen tekrar deneyin.";
  }
}

type Props = {
  reservation: OperationReservationRecord;
  driverName: string;
  driverPhone: string;
  onClose: () => void;
};

export function DriverWhatsAppModal({ reservation, driverName, driverPhone, onClose }: Props) {
  const [selection, setSelection] = useState<DriverTaskFieldSelection>(
    createDefaultDriverTaskSelection(),
  );
  const [message, setMessage] = useState(() =>
    buildDriverTaskMessage(reservation, createDefaultDriverTaskSelection(), driverName),
  );
  const [sendState, setSendState] = useState<SendState>({ status: "idle", message: "" });
  // Hızlı ardışık tıklamalarda ikinci bir gönderimi engellemek için: state güncellemesi
  // React tarafından render'a kadar ertelenebilir, ref ise senkron olarak hemen okunur/yazılır.
  const isSendingRef = useRef(false);

  useEffect(() => {
    setMessage(buildDriverTaskMessage(reservation, selection, driverName));
  }, [selection, reservation, driverName]);

  function toggleField(key: DriverTaskFieldKey) {
    setSelection((current) => ({ ...current, [key]: !current[key] }));
  }

  // Seçilen alanların en az birinin gerçekten veri içerip içermediğini kontrol eder
  // (buildDriverTaskMessage her zaman 3 sabit başlık satırı üretir). Ne hiçbir checkbox
  // seçilmemişse ne de seçilenlerin verisi boşsa gönder butonu aktif olmamalı.
  const hasMessageContent = message.split("\n").length > 3;

  async function handleSend() {
    if (isSendingRef.current || sendState.status === "sending" || sendState.status === "success") {
      return;
    }

    isSendingRef.current = true;
    setSendState({ status: "sending", message: "" });

    try {
      // Sunucu, gerçek mesajı reservationId + fields üzerinden checkbox seçimlerinden
      // yeniden oluşturuyor; textarea'daki (kullanıcının elle düzenlediği) metin buraya
      // hiç eklenmiyor ve gönderime hiçbir şekilde dahil edilmiyor.
      const response = await fetch(
        `/api/business/operations/${reservation.id}/driver-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ fields: selection }),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; code?: string; message?: string; status?: string }
        | null;

      if (!response.ok || !body?.ok) {
        setSendState({ status: "error", message: mapErrorCodeToMessage(body?.code) });
        return;
      }

      // Sunucu gerçek bir sağlayıcı hatasında bile "ok:true" ile "sent_placeholder"
      // döndürebilir (provider env tanımlı değilse veya gönderim gerçekte başarısız
      // olup placeholder'a düşerse) — bu durumda kullanıcıya "gönderildi" değil,
      // dürüst bir "hazırlandı ama gerçek gönderim yapılmadı" mesajı gösteriyoruz.
      if (body.status === "sent_placeholder") {
        setSendState({
          status: "success",
          message:
            "Mesaj hazırlandı, ancak gerçek bir WhatsApp sağlayıcısı bağlı olmadığı için gerçek gönderim yapılmadı.",
        });
        return;
      }

      setSendState({ status: "success", message: "Mesaj şoföre gönderildi." });
    } catch {
      setSendState({
        status: "error",
        message: "WhatsApp mesajı gönderilemedi. Lütfen tekrar deneyin.",
      });
    } finally {
      isSendingRef.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="grid w-full max-w-2xl gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Şoföre WhatsApp Gönder
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {driverName || "Şoför"} · {driverPhone || "-"}
            </h2>
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={() => setSelection(createDriverTaskSelection(true))}
          >
            Tümünü Seç
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={() => setSelection(createDriverTaskSelection(false))}
          >
            Tümünü Temizle
          </button>
        </div>

        <div className="grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          {DRIVER_TASK_FIELD_DEFINITIONS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selection[field.key]}
                onChange={() => toggleField(field.key)}
              />
              {field.label}
            </label>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold text-slate-950">Mesaj önizleme</div>
          {/*
            Bu textarea yalnızca önizleme/serbest düzenleme amaçlıdır. Kullanıcının burada
            yaptığı değişiklik gönderime dahil edilmez — gerçek mesaj sunucuda, reservationId
            ve checkbox seçimleri üzerinden buildDriverTaskMessage() ile yeniden kurulur.
          */}
          <textarea
            className="min-h-48 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className="text-xs text-slate-500">
            Bu alanı dilediğiniz gibi düzenleyebilirsiniz; gönderilecek gerçek mesaj sunucuda
            seçtiğiniz alanlardan yeniden oluşturulur, buradaki metin gönderime dahil edilmez.
          </p>
        </div>

        {sendState.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              sendState.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {sendState.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-700 bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={
              sendState.status === "sending" ||
              sendState.status === "success" ||
              !hasMessageContent
            }
            onClick={() => void handleSend()}
          >
            {sendState.status === "sending" ? "Gönderiliyor..." : "WhatsApp'a Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
