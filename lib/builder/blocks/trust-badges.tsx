import { buildBadgeListBlock } from "@/lib/builder/blocks/badge-list-shared";
import { registerBlock } from "@/lib/builder/registry";
import { asBlockKey } from "@/lib/builder/types";

// ============================================================
// Trust Badges — Faz 14. Şema/render mantığı badge-list-shared.tsx'te
// (logo/label/href/alt/monochrome-color/grid-carousel) — bkz. o dosyanın
// başındaki not.
// ============================================================

export const trustBadgesBlock = buildBadgeListBlock({
  key: asBlockKey("trust_badges"),
  label: "Güven Rozetleri",
  description: "Sertifika, sigorta veya güven veren rozetlerin logo şeridi.",
  family: "trust",
  defaultEyebrow: "Güvenilirlik",
  defaultTitle: "Neden bize güvenebilirsiniz?",
  defaultItems: [
    { label: "Sigortalı Araçlar" },
    { label: "7/24 Destek" },
    { label: "Lisanslı Şoförler" },
    { label: "Güvenli Ödeme" },
  ],
  emptyReason: "Henüz bir güven rozeti eklenmedi.",
  icon: "shield-check",
  paletteGroup: "Güven",
});

registerBlock(trustBadgesBlock);
