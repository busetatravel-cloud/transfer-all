import type { CSSProperties, ReactNode } from "react";
import type { ThemeSettings } from "@/lib/theme-types";
import { buildDesignSystemCssVariables, buildThemeCssVariables } from "@/lib/theme-tokens";

type Props = {
  settings: ThemeSettings;
  dir?: "ltr" | "rtl";
  lang?: string;
  className?: string;
  children: ReactNode;
};

// Yalnızca public site'ı sarar; admin paneli (components/panel-shell.tsx) bu
// bileşeni hiç kullanmaz ve app/globals.css'teki global değişkenlerden etkilenmez.
export function ThemeStyleProvider({ settings, dir = "ltr", lang, className = "", children }: Props) {
  const style = {
    ...buildDesignSystemCssVariables(),
    ...buildThemeCssVariables(settings),
    fontFamily: "var(--ps-font)",
  } as CSSProperties;

  return (
    <div
      dir={dir}
      lang={lang}
      data-ps-theme={settings.templateKey}
      data-ps-color-mode={settings.colorMode}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
