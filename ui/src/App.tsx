import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { App as McpApp, PostMessageTransport, useHostStyles, useDocumentTheme } from "@modelcontextprotocol/ext-apps/react";
import InteractiveDiagram from "./components/InteractiveDiagram";
import CodeEditor from "./components/CodeEditor";
import ViewSwitch, { type ViewMode } from "./components/ViewSwitch";
import SendButton from "./components/SendButton";
import ExportButton from "./components/ExportButton";
import CopyButton from "./components/CopyButton";
// ErrorDisplay removed -- errors are sent silently to AI for auto-fix
import { detectDiagramType } from "./engine/detect";
import { ChangeLog, type Change } from "./sync/changeLog";
import { silentSync, sendToAgent } from "./sync/syncLayer";
import { themeColors, mermaidTheme, setMermaidTheme } from "./theme";
import type { CodeChangeInfo } from "./components/InteractiveDiagram";

interface DiagramInput {
  mermaidCode: string;
  diagramType?: string;
}

/** Error info for silent AI auto-fix. */
interface RenderError {
  message: string;
  code: string; // the code that caused the error
}

const DEFAULT_HEIGHT = 500;

// Sample Mermaid code for standalone testing
const SAMPLE_MERMAID = `graph TD
  A([Start]) --> B[Process Data]
  B --> C{Decision}
  C -->|Yes| D[Action A]
  C -->|No| E[Action B]
  D --> F([End])
  E --> F`;

function App() {
  const [diagramInput, setDiagramInput] = useState<DiagramInput | null>(null);
  const [partial, setPartial] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>(SAMPLE_MERMAID);
  const [streaming, setStreaming] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  // Silent error collection for AI auto-fix
  const pendingError = useRef<RenderError | null>(null);
  const errorFixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorAlreadySent = useRef<string | null>(null); // track last sent error to avoid duplicates

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);

  // Container dimensions from host
  const [hostHeight, setHostHeight] = useState<string>(`${DEFAULT_HEIGHT}px`);

  // Track whether error came from AI tool input (auto-fix only for AI-generated code)
  const isToolInputError = useRef(false);

  // View switching state -- default to canvas view
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");

  // Change log for delta tracking
  const changeLog = useMemo(() => new ChangeLog(), []);
  const [changeCount, setChangeCount] = useState(0);

  // Timers
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detected diagram type
  const detectedType = detectDiagramType(mermaidCode);

  // Theme from host
  const theme = useDocumentTheme();
  const colors = themeColors(theme);

  // Compute root height based on fullscreen + containerDimensions
  const rootHeight = isFullscreen ? "100vh" : hostHeight;

  // Update Mermaid rendering theme when host theme changes
  useEffect(() => {
    setMermaidTheme(mermaidTheme(theme));
  }, [theme]);

  /** Process host context to extract display mode and container dimensions. */
  const processHostContext = useCallback((ctx: Record<string, unknown> | null | undefined) => {
    if (!ctx) return;

    // Check available display modes
    const availModes = ctx.availableDisplayModes as string[] | undefined;
    if (availModes) {
      setFullscreenAvailable(availModes.includes("fullscreen"));
    }

    // Track host-initiated display mode changes
    const displayMode = ctx.displayMode as string | undefined;
    if (displayMode) {
      setIsFullscreen(displayMode === "fullscreen");
    }

    // Process container dimensions
    const dims = ctx.containerDimensions as Record<string, number> | undefined;
    if (dims) {
      if ("height" in dims && typeof dims.height === "number") {
        // Host provides a fixed pixel height — use it directly
        setHostHeight(`${dims.height}px`);
      } else if ("maxHeight" in dims && typeof dims.maxHeight === "number") {
        // maxHeight constraint -- use min(DEFAULT_HEIGHT, maxHeight)
        const h = Math.min(DEFAULT_HEIGHT, dims.maxHeight);
        setHostHeight(`${h}px`);
      }
      // If neither, keep default 500px
    }
  }, []);

  const appRef = useRef<McpApp | null>(null);
  const [app, setApp] = useState<McpApp | null>(null);

  // Manual App creation with autoResize: false (useApp forces autoResize: true)
  useEffect(() => {
    const mcpApp = new McpApp(
      { name: "mermaid-app", version: "0.1.0" },
      {}, // capabilities
      { autoResize: false },
    );

    appRef.current = mcpApp;

    mcpApp.ontoolinput = (params) => {
      const args = params.arguments as Record<string, unknown>;
      const code = (args.mermaidCode as string) ?? "";
      isToolInputError.current = true;
      setDiagramInput({
        mermaidCode: code,
        diagramType: (args.diagramType as string) ?? undefined,
      });
      setMermaidCode(code);
      setPartial(null);
      setStreaming(false);
      changeLog.clear();
      setChangeCount(0);
    };

    mcpApp.ontoolinputpartial = (params) => {
      const args = params.arguments as Record<string, unknown> | undefined;
      if (args?.mermaidCode) {
        const partialCode = args.mermaidCode as string;
        setPartial(partialCode);
        setStreaming(true);
        setMermaidCode(partialCode);
      }
    };

    mcpApp.onhostcontextchanged = (params) => {
      processHostContext(params as Record<string, unknown>);
    };

    const transport = new PostMessageTransport(window.parent, window.parent);
    mcpApp.connect(transport)
      .then(() => {
        // Report initial size to host (autoResize is off, so we must do it manually)
        mcpApp.sendSizeChanged({ width: document.documentElement.scrollWidth, height: DEFAULT_HEIGHT });
        setApp(mcpApp);
      })
      .catch((err) => console.error("App connect failed:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHostStyles(app, app?.getHostContext());

  // Process initial host context on app creation
  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    processHostContext(ctx as Record<string, unknown> | null);
  }, [app, processHostContext]);

  // Reset hostHeight to default when exiting fullscreen.
  // The host may send large containerDimensions.height during fullscreen
  // which would persist after exiting, causing infinite height growth.
  const prevFullscreen = useRef(false);
  useEffect(() => {
    if (prevFullscreen.current && !isFullscreen) {
      setHostHeight(`${DEFAULT_HEIGHT}px`);
    }
    prevFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const currentApp = appRef.current;
        if (currentApp) {
          currentApp.requestDisplayMode({ mode: "inline" }).then((result) => {
            setIsFullscreen(result.mode === "fullscreen");
          }).catch(() => {
            setIsFullscreen(false);
          });
        } else {
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Silent error auto-fix: collect errors, debounce 3s, then send to AI
  const scheduleErrorAutoFix = useCallback(
    (error: RenderError) => {
      pendingError.current = error;

      // Clear any existing timer
      if (errorFixTimer.current) clearTimeout(errorFixTimer.current);

      errorFixTimer.current = setTimeout(() => {
        const err = pendingError.current;
        if (!err || !app) return;

        // Don't send the same error twice
        const errorKey = `${err.message}::${err.code.slice(0, 200)}`;
        if (errorAlreadySent.current === errorKey) return;

        // Only auto-fix errors from AI-generated code, not user edits
        if (!isToolInputError.current) return;

        errorAlreadySent.current = errorKey;
        app.sendMessage({
          role: "user",
          content: [{
            type: "text",
            text: `The Mermaid diagram has syntax errors. Please fix and regenerate.\n\nError: ${err.message}\n\nCurrent code:\n\`\`\`mermaid\n${err.code}\n\`\`\``,
          }],
        });
        pendingError.current = null;
      }, 3000);
    },
    [app],
  );

  // Handle code changes from editor or InteractiveDiagram (rename, layout toggle)
  const handleCodeChange = useCallback(
    (newCode: string, change?: CodeChangeInfo) => {
      setMermaidCode(newCode);
      // User-initiated edits should NOT auto-feedback to AI
      isToolInputError.current = false;

      // Record change in changeLog if metadata is provided
      if (change) {
        changeLog.add(change as Change);
        setChangeCount(changeLog.count);
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        // Mermaid re-renders automatically via InteractiveDiagram's useEffect
      }, 500);
    },
    [changeLog],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
      if (errorFixTimer.current) clearTimeout(errorFixTimer.current);
    };
  }, []);

  // Silent sync: debounced updateModelContext on semantic changes
  useEffect(() => {
    if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
    silentSyncTimer.current = setTimeout(() => {
      silentSync(app ?? null, mermaidCode, selectedElements, detectedType);
    }, 1500);
    return () => {
      if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
    };
  }, [app, mermaidCode, selectedElements, detectedType]);

  // Handle "Send to Agent" button click
  const handleSendToAgent = useCallback(() => {
    sendToAgent(app ?? null, changeLog, mermaidCode, selectedElements, detectedType);
    setChangeCount(0);
  }, [app, changeLog, mermaidCode, selectedElements, detectedType]);

  // Handle fullscreen toggle
  const handleToggleFullscreen = useCallback(async () => {
    const currentApp = appRef.current;
    if (!currentApp) return;

    const target = isFullscreen ? "inline" : "fullscreen";
    try {
      const result = await currentApp.requestDisplayMode({ mode: target as "inline" | "fullscreen" });
      setIsFullscreen(result.mode === "fullscreen");
    } catch {
      // If request fails, toggle locally as fallback
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  // Handle render errors silently — send to AI for auto-fix
  const handleRenderError = useCallback(
    (error: string | null) => {
      if (error) {
        scheduleErrorAutoFix({ message: error, code: mermaidCode });
      } else {
        // Render succeeded — clear pending errors and reset sent tracker
        pendingError.current = null;
        if (errorFixTimer.current) clearTimeout(errorFixTimer.current);
        errorAlreadySent.current = null;
      }
    },
    [scheduleErrorAutoFix, mermaidCode],
  );

  // Render the diagram with SendButton overlay (no visible error display)
  const renderDiagram = () => {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <InteractiveDiagram
          mermaidCode={mermaidCode}
          theme={theme}
          diagramType={detectedType}
          selectedElements={selectedElements}
          onSelectionChange={setSelectedElements}
          onCodeChange={handleCodeChange}
          onRenderError={handleRenderError}
          onSvgReady={setSvgContent}
        />
        <SendButton changeCount={changeCount} onClick={handleSendToAgent} theme={theme} />
      </div>
    );
  };

  // Render the code editor
  const renderCodeEditor = () => (
    <CodeEditor
      value={mermaidCode}
      onChange={handleCodeChange}
      theme={theme}
    />
  );

  return (
    <div
      className="mermaid-app-root"
      style={{
        width: "100%",
        height: rootHeight,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.canvasBg,
        color: theme === "dark" ? "#e4e4e7" : "#09090b",
        transition: "background-color 0.2s, color 0.2s",
        borderRadius: isFullscreen ? 0 : undefined,
      }}
    >
      {/* Global styles */}
      <style>{`
        .mermaid-app-root:hover .fullscreen-btn { opacity: 0.7 !important; }
        .fullscreen-btn:hover { opacity: 1 !important; }
        .fullscreen-btn:focus-visible { opacity: 1 !important; outline: 2px solid ${colors.accent}; outline-offset: 1px; }
        @keyframes streaming-pulse {
          0%,100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes streaming-dot {
          0%,20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%,100% { content: '...'; }
        }
        @media (prefers-reduced-motion: reduce) {
          .streaming-indicator { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: `1px solid ${colors.toolbarBorder}`,
          background: colors.toolbarBg,
          flexShrink: 0,
          transition: "all 0.2s ease",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 80,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: colors.accent,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            color: colors.toolbarLabel,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
          }}>
            Mermaid
          </span>
        </div>
        <ViewSwitch mode={viewMode} onChange={setViewMode} theme={theme} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 80, justifyContent: "flex-end" }}>
          <CopyButton code={mermaidCode} theme={theme} />
          <ExportButton svgContent={svgContent} theme={theme} />
        </div>
      </div>

      {/* Streaming indicator */}
      {streaming && (
        <div
          className="streaming-indicator"
          style={{
            padding: "3px 12px",
            textAlign: "center",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.02em",
            flexShrink: 0,
            color: colors.accent,
            borderBottom: `1px solid ${colors.toolbarBorder}`,
            background: colors.accentMuted,
            animation: "streaming-pulse 2s ease-in-out infinite",
          }}
        >
          Receiving diagram
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative" }}>
        {viewMode === "code" && (
          <div style={{ width: "100%", height: "100%" }}>
            {renderCodeEditor()}
          </div>
        )}

        {viewMode === "canvas" && (
          <div style={{ width: "100%", height: "100%" }}>
            {renderDiagram()}
          </div>
        )}

        {viewMode === "split" && (
          <>
            <div
              style={{
                width: "50%",
                height: "100%",
                borderRight: `1px solid ${colors.toolbarBorder}`,
                overflow: "hidden",
              }}
            >
              {renderCodeEditor()}
            </div>
            <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
              {renderDiagram()}
            </div>
          </>
        )}

        {/* Fullscreen toggle button -- bottom right, visible on hover */}
        {fullscreenAvailable && (
          <button
            className="fullscreen-btn"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              opacity: 0,
              zIndex: 20,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${colors.zoomBorder}`,
              borderRadius: 6,
              background: colors.zoomBg,
              color: colors.zoomText,
              cursor: "pointer",
              fontSize: 14,
              boxShadow: theme === "dark" ? "0 2px 8px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.08)",
              transition: "opacity 0.2s",
            }}
          >
            {isFullscreen ? (
              // Exit fullscreen icon (compress)
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4,1 4,4 1,4" />
                <polyline points="10,1 10,4 13,4" />
                <polyline points="4,13 4,10 1,10" />
                <polyline points="10,13 10,10 13,10" />
              </svg>
            ) : (
              // Enter fullscreen icon (expand)
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1,5 1,1 5,1" />
                <polyline points="9,1 13,1 13,5" />
                <polyline points="13,9 13,13 9,13" />
                <polyline points="5,13 1,13 1,9" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
