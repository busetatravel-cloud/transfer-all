import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { createTask, listTasks } from "@/lib/tasks";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tasks = await listTasks(auth.session.businessId);
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  console.info("business.tasks.post", {
    businessId: auth.session.businessId,
    action: body?.action,
    payload: body,
  });

  try {
    const task = await createTask(auth.session.businessId, {
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

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "task",
      entityId: task.id,
      action: "create",
      before: null,
      after: task,
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Görev oluşturulamadı.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
