import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { deleteTask, updateTask } from "@/lib/tasks";

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

  console.info("business.tasks.patch", {
    businessId: auth.session.businessId,
    taskId: id,
    payload: body,
  });

  try {
    const task = await updateTask(auth.session.businessId, {
      recordId: id,
      title: normalizeText(body?.title),
      description: normalizeText(body?.description),
      reservationId: normalizeText(body?.reservationId),
      customerName: normalizeText(body?.customerName),
      dueDate: normalizeText(body?.dueDate),
      dueTime: normalizeText(body?.dueTime),
      priority: normalizeText(body?.priority) as
        | "Düşük"
        | "Normal"
        | "Yüksek"
        | "Acil"
        | undefined,
      status: normalizeText(body?.status) as
        | "Bekliyor"
        | "Devam Ediyor"
        | "Tamamlandı"
        | "İptal"
        | undefined,
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Görev güncellenemedi.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  console.info("business.tasks.delete", {
    businessId: auth.session.businessId,
    taskId: id,
  });

  try {
    await deleteTask(auth.session.businessId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Görev silinemedi.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
