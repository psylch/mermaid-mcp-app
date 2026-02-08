import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, StateField, StateEffect, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { type Theme, themeColors } from "../theme";

/** Effect to set the error line (1-based) or null to clear. */
const setErrorLine = StateEffect.define<number | null>();

/** Line decoration for error highlighting. */
const errorLineDeco = Decoration.line({ class: "cm-errorLine" });

/** State field tracking the current error line decoration. */
const errorLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value == null) return Decoration.none;
        const lineNum = e.value;
        if (lineNum < 1 || lineNum > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(lineNum);
        return Decoration.set([errorLineDeco.range(line.from)]);
      }
    }
    return decos;
  },
});

function buildEditorTheme(t: Theme) {
  const colors = themeColors(t);
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        fontSize: "14px",
        backgroundColor: colors.editorBg,
        color: t === "dark" ? "#e2e8f0" : "#1a202c",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
      },
      ".cm-content": {
        padding: "8px 0",
        caretColor: t === "dark" ? "#e2e8f0" : "#1a202c",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: t === "dark" ? "#e2e8f0" : "#1a202c",
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        border: "none",
        color: colors.editorGutter,
      },
      ".cm-activeLine": {
        backgroundColor: colors.editorActiveLine,
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: t === "dark" ? "#a0aec0" : "#475569",
      },
      ...(t === "dark"
        ? { ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(99,130,191,0.35)" } }
        : {}),
      ".cm-errorLine": {
        backgroundColor: colors.errorLineBg,
        borderLeft: `3px solid ${colors.errorLineBorder}`,
      },
    },
    { dark: t === "dark" },
  );
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** 1-based line number to highlight as error, or null/undefined to clear. */
  errorLine?: number | null;
  theme?: Theme;
  className?: string;
  style?: React.CSSProperties;
}

export default function CodeEditor({ value, onChange, errorLine, theme = "light", className, style }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const themeCompartment = useRef(new Compartment());

  // Track whether an external value update is in progress to avoid echo
  const externalUpdate = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !externalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        updateListener,
        errorLineField,
        themeCompartment.current.of(buildEditorTheme(theme)),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === value) return;

    externalUpdate.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: value,
      },
    });
    externalUpdate.current = false;
  }, [value]);

  // Sync error line highlight into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setErrorLine.of(errorLine ?? null) });
  }, [errorLine]);

  // Sync theme changes into the editor via compartment reconfiguration
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(buildEditorTheme(theme)),
    });
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
