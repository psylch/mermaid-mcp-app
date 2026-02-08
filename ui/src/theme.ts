/**
 * Theme utilities for the Mermaid MCP App.
 *
 * Uses the host CSS variables applied by useHostStyles() and
 * useDocumentTheme() for reactive dark/light detection.
 *
 * Strategy: use CSS variables from the host where available,
 * with sensible fallbacks for standalone development.
 */

export type Theme = "light" | "dark";

/** CSS variable references with fallbacks for standalone mode */
export const themeVars = {
  // Backgrounds
  bgPrimary: "var(--color-background-primary, #ffffff)",
  bgSecondary: "var(--color-background-secondary, #f9fafb)",
  bgTertiary: "var(--color-background-tertiary, #f3f4f6)",
  bgInverse: "var(--color-background-inverse, #111827)",
  bgDanger: "var(--color-background-danger, #fef2f2)",

  // Text
  textPrimary: "var(--color-text-primary, #111827)",
  textSecondary: "var(--color-text-secondary, #6b7280)",
  textTertiary: "var(--color-text-tertiary, #9ca3af)",
  textInverse: "var(--color-text-inverse, #ffffff)",
  textDanger: "var(--color-text-danger, #dc2626)",

  // Borders
  borderPrimary: "var(--color-border-primary, #e5e7eb)",
  borderSecondary: "var(--color-border-secondary, #d1d5db)",

  // Fonts
  fontSans: "var(--font-sans, system-ui, -apple-system, sans-serif)",
  fontMono: "var(--font-mono, 'SF Mono', 'Fira Code', Menlo, Consolas, monospace)",

  // Shadows
  shadowSm: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
  shadowMd: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.1))",

  // Radius
  radiusSm: "var(--border-radius-sm, 4px)",
  radiusMd: "var(--border-radius-md, 8px)",
  radiusLg: "var(--border-radius-lg, 12px)",
} as const;

/** Map host theme to Mermaid theme name */
export function mermaidTheme(theme: Theme): string {
  return theme === "dark" ? "neutral" : "default";
}

/** Current Mermaid theme, tracked for initialization. */
let currentMermaidTheme = "default";

/** Update the Mermaid rendering theme. Call when the host theme changes. */
export function setMermaidTheme(theme: string) {
  currentMermaidTheme = theme;
}

/** Get the current Mermaid theme. */
export function getMermaidTheme(): string {
  return currentMermaidTheme;
}

/**
 * Dark-mode specific overrides that can't use CSS variables
 * (e.g. for inline SVG rendering, CodeMirror themes, etc.)
 */
export function themeColors(theme: Theme) {
  if (theme === "dark") {
    return {
      // Zinc neutral dark — no blue tint
      canvasBg: "#09090b",
      editorBg: "#0a0a0b",
      editorGutter: "#52525b",
      editorActiveLine: "rgba(161,161,170,0.06)",
      errorLineBg: "rgba(239, 68, 68, 0.15)",
      errorLineBorder: "#ef4444",
      errorOverlayBg: "rgba(0,0,0,0.75)",
      errorCardBg: "#2d1b1b",
      errorCardBorder: "#7f1d1d",
      errorBadgeBg: "#ef4444",
      errorMsgColor: "#fca5a5",
      errorLineColor: "#a1a1aa",
      errorSubColor: "#71717a",
      sendBtnBg: "#22c55e",
      sendBtnShadow: "0 2px 16px rgba(34,197,94,0.4), 0 1px 4px rgba(0,0,0,0.5)",
      switchBg: "#18181b",
      switchBorder: "#27272a",
      switchActiveBg: "#27272a",
      switchActiveText: "#fafafa",
      switchInactiveText: "#71717a",
      toolbarBg: "linear-gradient(180deg, #18181b 0%, #111113 100%)",
      toolbarBgFlat: "#18181b",
      toolbarBorder: "#27272a",
      toolbarLabel: "#71717a",
      toolbarLabelAccent: "#4ade80",
      zoomBg: "#18181b",
      zoomBorder: "#27272a",
      zoomText: "#a1a1aa",
      exportBg: "transparent",
      exportBorder: "#27272a",
      exportText: "#a1a1aa",
      exportHover: "rgba(161,161,170,0.08)",
      switchHoverBg: "rgba(161,161,170,0.06)",
      accent: "#4ade80",
      accentMuted: "rgba(74,222,128,0.1)",
      separator: "#27272a",
    };
  }
  return {
    // Zinc neutral light — clean and warm
    canvasBg: "#fafafa",
    editorBg: "#ffffff",
    editorGutter: "#a1a1aa",
    editorActiveLine: "rgba(113,113,122,0.06)",
    errorLineBg: "rgba(239, 68, 68, 0.08)",
    errorLineBorder: "#ef4444",
    errorOverlayBg: "rgba(255,255,255,0.8)",
    errorCardBg: "#fef2f2",
    errorCardBorder: "#fecaca",
    errorBadgeBg: "#ef4444",
    errorMsgColor: "#991b1b",
    errorLineColor: "#71717a",
    errorSubColor: "#a1a1aa",
    sendBtnBg: "#16a34a",
    sendBtnShadow: "0 2px 12px rgba(22,163,74,0.25), 0 1px 3px rgba(0,0,0,0.06)",
    switchBg: "#f4f4f5",
    switchBorder: "#e4e4e7",
    switchActiveBg: "#ffffff",
    switchActiveText: "#09090b",
    switchInactiveText: "#71717a",
    toolbarBg: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
    toolbarBgFlat: "#fafafa",
    toolbarBorder: "#e4e4e7",
    toolbarLabel: "#a1a1aa",
    toolbarLabelAccent: "#16a34a",
    zoomBg: "#ffffff",
    zoomBorder: "#e4e4e7",
    zoomText: "#71717a",
    exportBg: "transparent",
    exportBorder: "#d4d4d8",
    exportText: "#71717a",
    exportHover: "rgba(9,9,11,0.04)",
    switchHoverBg: "rgba(9,9,11,0.04)",
    accent: "#16a34a",
    accentMuted: "rgba(22,163,74,0.08)",
    separator: "#e4e4e7",
  };
}
