import { useState } from "react";
import { type Theme, themeColors } from "../theme";

interface CopyButtonProps {
  code: string;
  theme?: Theme;
}

export default function CopyButton({ code, theme = "light" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const colors = themeColors(theme);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for iframe sandbox restrictions
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <style>{`
        .copy-btn:hover:not(.copy-btn--copied) {
          background-color: ${colors.exportHover} !important;
          color: ${colors.switchActiveText} !important;
        }
        .copy-btn:focus-visible {
          box-shadow: inset 0 0 0 1.5px ${colors.accent} !important;
          outline: none;
        }
      `}</style>
      <button
        type="button"
        className={`copy-btn${copied ? " copy-btn--copied" : ""}`}
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy code"}
        style={{
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 500,
          lineHeight: "18px",
          cursor: "pointer",
          border: `1px solid ${copied ? colors.accent : colors.exportBorder}`,
          borderRadius: 5,
          backgroundColor: copied ? colors.accent : colors.exportBg,
          color: copied ? "#fff" : colors.exportText,
          transition: "all 0.2s ease",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          outline: "none",
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5 7.5 5.5 10.5 11.5 3.5" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" />
            <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" />
          </svg>
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </>
  );
}
