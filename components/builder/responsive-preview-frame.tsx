import type { ReactNode } from "react";
import { BREAKPOINTS } from "@/lib/design-system/tokens";

// Yeniden kullanılabilir responsive önizleme çerçevesi (Faz 5).
//
// Bu fazda gerçek bir iframe live preview YOK — bu yalnızca izole bir
// component, henüz hiçbir admin sayfasına bağlanmadı. Live Preview (ileriki
// bir faz) bunu doğrudan bir iframe'in İÇİNDE veya admin panelinde yan yana
// kullanabilir; genişlik kaynağı (Faz 1'deki BREAKPOINTS veya bir template'in
// kendi preview.*PreviewWidth metadata'sı) dışarıdan enjekte edilebilir
// olduğu için ileride kolayca taşınabilir.

export type PreviewMode = "desktop" | "tablet" | "mobile";

export function ResponsivePreviewFrame({
  mode,
  widths,
  children,
}: {
  mode: PreviewMode;
  // Verilmezse Faz 1'in BREAKPOINTS sabitleri kullanılır. Bir template'in
  // preview.desktopPreviewWidth/tabletPreviewWidth/mobilePreviewWidth
  // değerleri de buraya doğrudan geçirilebilir.
  widths?: { desktop: number; tablet: number; mobile: number };
  children: ReactNode;
}) {
  const resolvedWidths = widths ?? BREAKPOINTS;
  const width = resolvedWidths[mode];

  return (
    <div
      data-preview-mode={mode}
      className="mx-auto overflow-x-hidden border border-slate-200 bg-white"
      style={{ maxWidth: `${width}px`, minHeight: "480px", width: "100%" }}
    >
      {children}
    </div>
  );
}
