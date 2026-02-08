import { type Theme, themeColors } from "../theme";

interface SendButtonProps {
  changeCount: number;
  onClick: () => void;
  theme?: Theme;
}

export default function SendButton({ changeCount, onClick, theme = "light" }: SendButtonProps) {
  if (changeCount === 0) return null;

  const colors = themeColors(theme);

  return (
    <div style={containerStyle}>
      <style>{`
        .send-btn:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: ${colors.sendBtnShadow} !important; }
        .send-btn:active { transform: translateY(0); filter: brightness(0.95); }
        .send-btn:focus-visible { outline: 2px solid ${colors.accent}; outline-offset: 2px; }
      `}</style>
      <button
        type="button"
        className="send-btn"
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.01em",
          lineHeight: "18px",
          color: "#ffffff",
          backgroundColor: colors.sendBtnBg,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: colors.sendBtnShadow,
          transition: "all 0.2s ease",
        }}
        title={`Send ${changeCount} change${changeCount !== 1 ? "s" : ""} to Agent`}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 7h12M8 2l5 5-5 5" />
        </svg>
        Send to Agent
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: "16px",
            color: colors.sendBtnBg,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 8,
          }}
        >
          {changeCount}
        </span>
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 56,
  right: 16,
  zIndex: 20,
};
