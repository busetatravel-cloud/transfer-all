import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  buildBusinessMediaStoragePath,
  createBusinessMediaAsset,
  deleteBusinessMediaAsset,
  uploadBusinessMediaFile,
} from "@/lib/media";

function toNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

function toString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const kind = toString(formData.get("kind"));
  const action = toString(formData.get("action")) || "update";
  const altText = toString(formData.get("altText"));
  const previewDataUrl = toString(formData.get("previewDataUrl"));
  const fileName = toString(formData.get("fileName"));
  const file = formData.get("file");
  const cropX = toNumber(formData.get("cropX"), 50);
  const cropY = toNumber(formData.get("cropY"), 50);
  const zoom = toNumber(formData.get("zoom"), 1);
  const sortOrder = toNumber(formData.get("sortOrder"), 0);
  const cover = toBoolean(formData.get("cover"));

  if (!kind) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "Medya türü gerekli." },
      { status: 400 },
    );
  }

  if (action === "delete") {
    await deleteBusinessMediaAsset(auth.session.businessId, kind);
    return NextResponse.json({ ok: true, deleted: true });
  }

  let sourceUrl = previewDataUrl;
  let storagePath = "";
  let status: "placeholder" | "ready" | "failed" = "placeholder";

  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadBusinessMediaFile(auth.session.businessId, kind, file).catch(
      (error) => {
        console.warn("business.media.upload.failed", {
          businessId: auth.session.businessId,
          kind,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      },
    );

    if (uploaded) {
      sourceUrl = uploaded.sourceUrl;
      storagePath = uploaded.storagePath;
      status = "ready";
    }
  }

  const asset = await createBusinessMediaAsset(auth.session.businessId, {
    kind,
    sourceUrl,
    storagePath,
    altText: altText || kind,
    status,
    metadata: {
      previewDataUrl: previewDataUrl || sourceUrl || "",
      cropX,
      cropY,
      zoom,
      slot: kind,
      altText: altText || kind,
      fileName:
        fileName ||
        (file instanceof File ? file.name : "") ||
        (storagePath ? storagePath.split("/").pop() ?? "" : ""),
      cover,
    },
    sortOrder,
  });

  await recordAuditLog({
    businessId: auth.session.businessId,
    actorUserId: auth.session.userId,
    actorRole: auth.session.role,
    entityType: "media",
    entityId: asset.id,
    action: "create",
    before: null,
    after: asset,
  });

  return NextResponse.json({
    ok: true,
    asset,
    uploadPath:
      storagePath || buildBusinessMediaStoragePath(auth.session.businessId, kind, fileName || "upload"),
    uploaded: status === "ready",
  });
}
