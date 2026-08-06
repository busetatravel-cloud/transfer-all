import { buildBadgeListBlock } from "@/lib/builder/blocks/badge-list-shared";
import { registerBlock } from "@/lib/builder/registry";
import { asBlockKey } from "@/lib/builder/types";

// ============================================================
// Partners / Logos — Faz 14. Şema/render mantığı badge-list-shared.tsx'te
// (logo/label/href/alt/monochrome-color/grid-carousel) — bkz. o dosyanın
// başındaki not. Trust Badges ile AYNI görsel dile sahiptir, ayrı bir
// registry anahtarı olarak ("partners") tutulur çünkü admin paletinde
// kavramsal olarak farklı bir amaç taşır (iş ortağı/acente logoları).
// ============================================================

export const partnersBlock = buildBadgeListBlock({
  key: asBlockKey("partners"),
  label: "İş Ortakları",
  description: "Anlaşmalı otel, acente veya iş ortağı logolarının şeridi.",
  family: "trust",
  defaultEyebrow: "İş Ortaklarımız",
  defaultTitle: "Birlikte çalıştığımız markalar",
  defaultItems: [{ label: "Otel Grubu A" }, { label: "Acente B" }, { label: "Tur Operatörü C" }],
  emptyReason: "Henüz bir iş ortağı logosu eklenmedi.",
  icon: "handshake",
  paletteGroup: "Güven",
});

registerBlock(partnersBlock);
