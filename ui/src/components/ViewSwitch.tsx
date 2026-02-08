import { type Theme, themeColors } from "../theme";

export type ViewMode = "code" | "split" | "canvas";

interface ViewSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  theme?: Theme;
}

const MODES: { key: ViewMode; label: string; title: string }[] = [
  { key: "code", label: "Code", title: "Code view" },
  { key: "split", label: "Split", title: "Split view" },
  { key: "canvas", label: "Canvas", title: "Canvas view" },
];

export default function ViewSwitch({ mode, onChange, theme = "light" }: ViewSwitchProps) {
  const colors = themeColors(theme);

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    gap: 1,
    padding: 2,
    borderRadius: 7,
    border: `1px solid ${colors.switchBorder}`,
    backgroundColor: colors.switchBg,
    flexShrink: 0,
  };

  function buttonStyle(active: boolean): React.CSSProperties {
    return {
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      letterSpacing: "0.02em",
      lineHeight: "18px",
      cursor: "pointer",
      border: "none",
      borderRadius: 5,
      backgroundColor: active ? colors.switchActiveBg : "transparent",
      color: active ? colors.switchActiveText : colors.switchInactiveText,
      boxShadow: active
        ? theme === "dark"
          ? "0 1px 2px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
        : "none",
      transition: "all 0.15s ease",
      outline: "none",
    };
  }

  return (
    <div style={containerStyle}>
      <style>{`
        .view-switch-btn:not([aria-pressed="true"]):hover {
          background-color: ${colors.switchHoverBg} !important;
          color: ${colors.switchActiveText} !important;
        }
        .view-switch-btn:focus-visible {
          box-shadow: inset 0 0 0 1.5px ${colors.accent} !important;
          outline: none;
        }
      `}</style>
      {MODES.map(({ key, label, title }) => (
        <button
          key={key}
          type="button"
          className="view-switch-btn"
          style={buttonStyle(mode === key)}
          onClick={() => onChange(key)}
          aria-pressed={mode === key}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
