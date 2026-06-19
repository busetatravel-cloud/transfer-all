import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import {
  markNotificationAsRead,
  markNotificationAsUnread,
} from "@/lib/notifications";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = normalizeText(body?.status) as "read" | "unread";

  if (status !== "read" && status !== "unread") {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Geçersiz bildirim durumu.",
      },
      { status: 400 },
    );
  }

  try {
    if (status === "read") {
      await markNotificationAsRead(auth.session.businessId, id);
    } else {
      await markNotificationAsUnread(auth.session.businessId, id);
    }

    return NextResponse.json({
      ok: true,
      notificationId: id,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Bildirim güncellenemedi.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
