import { useState, useRef, useEffect } from "react";
import { type Theme, themeColors } from "../theme";
import { exportSvg, exportPng } from "../engine/export";

interface ExportButtonProps {
  svgContent: string | null;
  theme?: Theme;
}

export default function ExportButton({ svgContent, theme = "light" }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = themeColors(theme);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExportSvg = () => {
    if (svgContent) {
      exportSvg(svgContent);
      setOpen(false);
    }
  };

  const handleExportPng = async () => {
    if (svgContent) {
      setExporting(true);
      await exportPng(svgContent);
      setExporting(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <style>{`
        .export-trigger:hover {
          background-color: ${colors.exportHover} !important;
          color: ${colors.switchActiveText} !important;
        }
        .export-trigger:focus-visible, .export-item:focus-visible {
          box-shadow: inset 0 0 0 1.5px ${colors.accent} !important;
          outline: none;
        }
        .export-item:hover:not(:disabled) {
          background-color: ${colors.exportHover} !important;
          color: ${colors.switchActiveText} !important;
        }
      `}</style>
      <button
        type="button"
        className="export-trigger"
        onClick={() => setOpen(!open)}
        style={{
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 500,
          lineHeight: "18px",
          cursor: "pointer",
          border: `1px solid ${colors.exportBorder}`,
          borderRadius: 5,
          backgroundColor: colors.exportBg,
          color: colors.exportText,
          transition: "all 0.15s ease",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          outline: "none",
        }}
        title="Export diagram"
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1v8M3 6l4 4 4-4M2 12h10" />
        </svg>
        Export
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            minWidth: 110,
            backgroundColor: colors.switchBg,
            border: `1px solid ${colors.switchBorder}`,
            borderRadius: 6,
            boxShadow: theme === "dark"
              ? "0 4px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)"
              : "0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.05)",
            zIndex: 50,
            overflow: "hidden",
            padding: 2,
          }}
        >
          <button
            type="button"
            className="export-item"
            onClick={handleExportSvg}
            disabled={!svgContent}
            style={{
              ...dropdownItemStyle,
              color: colors.exportText,
              opacity: svgContent ? 1 : 0.3,
            }}
          >
            SVG
          </button>
          <button
            type="button"
            className="export-item"
            onClick={handleExportPng}
            disabled={!svgContent || exporting}
            style={{
              ...dropdownItemStyle,
              color: colors.exportText,
              opacity: svgContent && !exporting ? 1 : 0.3,
            }}
          >
            {exporting ? "Exporting..." : "PNG"}
          </button>
        </div>
      )}
    </div>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 500,
  textAlign: "left",
  border: "none",
  borderRadius: 4,
  backgroundColor: "transparent",
  cursor: "pointer",
  transition: "all 0.1s ease",
};
