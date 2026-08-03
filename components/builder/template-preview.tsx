import { PagePreview } from "@/components/builder/page-preview";
import { ThemeStyleProvider } from "@/components/theme/theme-style-provider";
import { isTemplateResolutionError, resolveTemplatePreview } from "@/lib/builder/render-template";

// Template Preview — tek sorumluluğu: bir template_key + page_key'i
// çözüp doğru Theme'i uygulamak ve Page Preview'ı onun içine yerleştirmek.
//
// Theme uygulaması TAMAMEN registry üzerinden çözülür (hardcoded if/else
// YOK): Modern Transfer -> "modern" temayı, Luxury VIP -> "luxury" temayı,
// Airport Shuttle -> "modern" temayı otomatik olarak Theme Registry'den
// alır. Mevcut ThemeStyleProvider AYNEN yeniden kullanılır — admin panelinin
// kendi tema token'ları (app/globals.css'teki --brand/--accent/--surface)
// bu bileşenin dışında kaldığı için hiç etkilenmez.

export function TemplatePreview({
  templateKey,
  pageKey = "home",
}: {
  templateKey: string;
  pageKey?: string;
}) {
  const resolution = resolveTemplatePreview(templateKey, pageKey);

  if (isTemplateResolutionError(resolution)) {
    return <TemplateResolutionNotice error={resolution} />;
  }

  const { themeEntry, page } = resolution;

  return (
    <ThemeStyleProvider
      settings={themeEntry.settings}
      dir="ltr"
      lang="tr"
      className="min-h-screen bg-[var(--ps-background)] text-[var(--ps-text)]"
    >
      <div style={{ paddingBlock: "var(--ps-space-2xl)" }}>
        <PagePreview page={page} />
      </div>
    </ThemeStyleProvider>
  );
}

// Bilinmeyen template/page key'i için AÇIK, görünür bir uyarı — hiçbir
// zaman başka bir template'e (ör. varsayılan Modern Transfer'e) sessizce
// düşürülmez.
function TemplateResolutionNotice({
  error,
}: {
  error: { type: "template_not_found"; templateKey: string } | { type: "page_not_found"; templateKey: string; pageKey: string };
}) {
  const message =
    error.type === "template_not_found"
      ? `Bilinmeyen template: "${error.templateKey}". Template Registry'de kayıtlı değil.`
      : `Template "${error.templateKey}" içinde "${error.pageKey}" adlı bir sayfa bulunamadı.`;

  return (
    <div className="grid min-h-[240px] place-items-center bg-slate-50 p-8 text-center">
      <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold uppercase tracking-wide">Önizleme oluşturulamadı</p>
        <p className="mt-2">{message}</p>
      </div>
    </div>
  );
}
