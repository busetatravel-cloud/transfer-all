export type ThemeTemplateKey = "modern" | "luxury";

export type ThemeBorderRadiusToken = "none" | "sm" | "md" | "lg" | "full";
export type ThemeShadowToken = "none" | "soft" | "medium" | "strong";
export type ThemeColorModeToken = "light" | "dark";

export type ThemeSettings = {
  templateKey: ThemeTemplateKey;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  borderRadius: ThemeBorderRadiusToken;
  shadow: ThemeShadowToken;
  fontFamily: string;
  colorMode: ThemeColorModeToken;
};
