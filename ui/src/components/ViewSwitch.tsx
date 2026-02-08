import { type Theme, themeColors } from "../theme";

export type ViewMode = "code" | "split" | "canvas";

interface ViewSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  theme?: Theme;
}

const MODES: { key: ViewMode; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "split", label: "Split" },
  { key: "canvas", label: "Canvas" },
];

export default function ViewSwitch({ mode, onChange, theme = "light" }: ViewSwitchProps) {
  const colors = themeColors(theme);

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    gap: 0,
    borderRadius: 8,
    overflow: "hidden",
    border: `1px solid ${colors.switchBorder}`,
    backgroundColor: colors.switchBg,
    flexShrink: 0,
  };

  function buttonStyle(active: boolean): React.CSSProperties {
    return {
      padding: "4px 14px",
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      lineHeight: "22px",
      cursor: "pointer",
      border: "none",
      backgroundColor: active ? colors.switchActiveBg : "transparent",
      color: active ? colors.switchActiveText : colors.switchInactiveText,
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
      transition: "background-color 0.15s, color 0.15s, box-shadow 0.15s",
      outline: "none",
    };
  }

  return (
    <div style={containerStyle}>
      {MODES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          style={buttonStyle(mode === key)}
          onClick={() => onChange(key)}
          aria-pressed={mode === key}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
