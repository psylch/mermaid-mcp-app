import { type Theme, themeColors } from "../theme";

/** Structured error from a parse/render failure. */
export interface ParseError {
  line: number | null;
  message: string;
}

interface ErrorDisplayProps {
  error: ParseError;
  /** If true, a previous render is shown dimmed underneath this overlay. */
  hasPreviousRender: boolean;
  theme?: Theme;
}

export default function ErrorDisplay({ error, hasPreviousRender, theme = "light" }: ErrorDisplayProps) {
  const colors = themeColors(theme);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
        backgroundColor: hasPreviousRender ? colors.errorOverlayBg : undefined,
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 480,
          padding: "16px 20px",
          borderRadius: 8,
          backgroundColor: colors.errorCardBg,
          border: `1px solid ${colors.errorCardBorder}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            backgroundColor: colors.errorBadgeBg,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            marginBottom: 8,
          }}
        >
          Parse Error
        </div>

        {error.line != null && (
          <div style={{ fontSize: 12, color: colors.errorLineColor, marginBottom: 4 }}>
            Line {error.line}
          </div>
        )}

        <div
          style={{
            fontSize: 13,
            color: colors.errorMsgColor,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error.message}
        </div>

        {hasPreviousRender && (
          <div style={{ marginTop: 10, fontSize: 12, color: colors.errorSubColor }}>
            Showing last successful render below.
          </div>
        )}
      </div>
    </div>
  );
}
