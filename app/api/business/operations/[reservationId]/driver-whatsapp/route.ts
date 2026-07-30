import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import { getOperationsReservationById, listAssignments, listDrivers } from "@/lib/operations";
import { InvalidWhatsAppPhoneError, sendVoucherWhatsApp } from "@/lib/whatsapp";
import {
  DRIVER_TASK_FIELD_KEYS,
  buildDriverTaskMessage,
  type DriverTaskFieldSelection,
} from "@/lib/driver-task-message";

function parseFieldSelection(raw: unknown): DriverTaskFieldSelection {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return DRIVER_TASK_FIELD_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Boolean(source[key]);
    return accumulator;
  }, {} as DriverTaskFieldSelection);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { reservationId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    ensureNoBusinessIdSpoofing(body, auth.session.businessId);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message:
          error instanceof Error && error.message === "business_id_mismatch"
            ? "businessId session ile uyusmuyor."
            : "Gecersiz istek.",
      },
      { status: 400 },
    );
  }

  const reservation = await getOperationsReservationById(auth.session.businessId, reservationId);

  if (!reservation) {
    return NextResponse.json(
      { ok: false, code: "not_found", message: "Rezervasyon bulunamadı." },
      { status: 404 },
    );
  }

  const [assignments, drivers] = await Promise.all([
    listAssignments(auth.session.businessId),
    listDrivers(auth.session.businessId),
  ]);

  const assignment = assignments.find((item) => item.reservationId === reservationId);
  const driver = assignment?.driverId
    ? (drivers.find((item) => item.id === assignment.driverId) ?? null)
    : null;

  if (!driver) {
    return NextResponse.json(
      {
        ok: false,
        code: "driver_not_assigned",
        message: "Bu rezervasyona atanmış bir şoför yok.",
      },
      { status: 400 },
    );
  }

  const phone = driver.phone?.trim();

  if (!phone) {
    return NextResponse.json(
      {
        ok: false,
        code: "driver_phone_missing",
        message: "Atanan şoförün telefon numarası yok.",
      },
      { status: 400 },
    );
  }

  const selection = parseFieldSelection(body?.fields);
  const message = buildDriverTaskMessage(reservation, selection, driver.name);

  // buildDriverTaskMessage her zaman sabit 3 başlık satırı üretir (selamlama, boş satır,
  // "Yeni transfer görevi:"); hiçbir checkbox seçilmemişse veya seçilen alanların verisi
  // boşsa mesajda bu 3 satırdan fazlası oluşmaz. Bu durumda anlamsız/boş bir görev mesajını
  // şoföre göndermek yerine isteği reddediyoruz.
  const hasSelectedContent = message.split("\n").length > 3;

  if (!hasSelectedContent) {
    return NextResponse.json(
      {
        ok: false,
        code: "empty_message",
        message: "Gönderilecek en az bir alan seçilmeli ve seçilen alanların verisi dolu olmalı.",
      },
      { status: 400 },
    );
  }

  let result;

  try {
    result = await sendVoucherWhatsApp({ to: phone, body: message });
  } catch (error) {
    if (error instanceof InvalidWhatsAppPhoneError) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_driver_phone",
          message: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "send_failed",
        message: error instanceof Error ? error.message : "WhatsApp gönderilemedi.",
      },
      { status: 500 },
    );
  }

  // sendVoucherWhatsApp gerçek bir sağlayıcı hatasında bile exception fırlatmayabilir
  // ("sent_placeholder" ile sessizce döner); bu yüzden ok:true'yu yalnızca throw etmediği
  // için değil, dönen status'e bakarak veriyoruz — aksi halde gerçekte gönderilmeyen bir
  // mesaj kullanıcıya "gönderildi" olarak gösterilebilir.
  return NextResponse.json({
    ok: true,
    status: result.status,
    provider: result.provider,
  });
}
