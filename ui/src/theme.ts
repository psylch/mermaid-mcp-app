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
  return theme === "dark" ? "dark" : "default";
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
      canvasBg: "#1a1b26",
      editorBg: "#1a1b26",
      editorGutter: "#4a5568",
      editorActiveLine: "rgba(255,255,255,0.05)",
      errorLineBg: "rgba(220, 38, 38, 0.15)",
      errorLineBorder: "#ef4444",
      errorOverlayBg: "rgba(0,0,0,0.75)",
      errorCardBg: "#2d1b1b",
      errorCardBorder: "#7f1d1d",
      errorBadgeBg: "#dc2626",
      errorMsgColor: "#fca5a5",
      errorLineColor: "#9ca3af",
      errorSubColor: "#6b7280",
      sendBtnBg: "#3b82f6",
      sendBtnShadow: "0 2px 8px rgba(59,130,246,0.4), 0 1px 3px rgba(0,0,0,0.3)",
      switchBg: "#2d3748",
      switchBorder: "#4a5568",
      switchActiveBg: "#4a5568",
      switchActiveText: "#f7fafc",
      switchInactiveText: "#a0aec0",
      toolbarBg: "#1e2030",
      toolbarBorder: "#2d3748",
      toolbarLabel: "#a0aec0",
      zoomBg: "#2d3748",
      zoomBorder: "#4a5568",
      zoomText: "#e2e8f0",
    };
  }
  return {
    canvasBg: "#ffffff",
    editorBg: "#ffffff",
    editorGutter: "#94a3b8",
    editorActiveLine: "rgba(100,116,139,0.08)",
    errorLineBg: "rgba(220, 38, 38, 0.10)",
    errorLineBorder: "#dc2626",
    errorOverlayBg: "rgba(255,255,255,0.75)",
    errorCardBg: "#fef2f2",
    errorCardBorder: "#fca5a5",
    errorBadgeBg: "#dc2626",
    errorMsgColor: "#991b1b",
    errorLineColor: "#6b7280",
    errorSubColor: "#9ca3af",
    sendBtnBg: "#2563eb",
    sendBtnShadow: "0 2px 8px rgba(37,99,235,0.35), 0 1px 3px rgba(0,0,0,0.1)",
    switchBg: "#f3f4f6",
    switchBorder: "#d1d5db",
    switchActiveBg: "#ffffff",
    switchActiveText: "#111827",
    switchInactiveText: "#6b7280",
    toolbarBg: "#fafafa",
    toolbarBorder: "#e5e7eb",
    toolbarLabel: "#6b7280",
    zoomBg: "#ffffff",
    zoomBorder: "#dddddd",
    zoomText: "#333333",
  };
}
