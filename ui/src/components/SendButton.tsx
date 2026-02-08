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
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          lineHeight: "20px",
          color: "#ffffff",
          backgroundColor: colors.sendBtnBg,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: colors.sendBtnShadow,
          transition: "background-color 0.15s, box-shadow 0.15s",
        }}
        title={`Send ${changeCount} change${changeCount !== 1 ? "s" : ""} to Agent`}
      >
        Send to Agent
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: "20px",
            color: colors.sendBtnBg,
            backgroundColor: "#ffffff",
            borderRadius: 10,
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
  bottom: 16,
  right: 16,
  zIndex: 20,
};
