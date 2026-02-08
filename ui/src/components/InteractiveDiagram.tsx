/**
 * InteractiveDiagram: renders Mermaid diagrams as native SVG with pan/zoom.
 *
 * Replaces both Canvas.tsx (oxdraw) and ReadOnlyDiagram.tsx.
 * All diagram types are rendered through Mermaid.js natively.
 *
 * S1: Mermaid rendering + pan/zoom
 * S2: Click-to-select + box select (marquee)
 * S3: Double-click to edit node text + layout direction toggle
 */
import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { type Theme, themeColors, mermaidTheme } from "../theme";

let renderCounter = 0;

/** Metadata describing what changed when onCodeChange is called. */
export type CodeChangeInfo =
  | { type: "rename"; nodeId: string; oldLabel: string; newLabel: string }
  | { type: "layout-change"; oldDirection: string; newDirection: string };

export interface InteractiveDiagramProps {
  mermaidCode: string;
  theme: Theme;
  diagramType: string;
  selectedElements: string[];
  onSelectionChange: (elements: string[]) => void;
  onCodeChange: (code: string, change?: CodeChangeInfo) => void;
  onRenderError?: (error: string | null) => void;
}

/** Selection highlight color */
const SELECTION_COLOR = "#3b82f6";

/** Layout directions that flowcharts support */
const DIRECTIONS = ["TD", "LR", "RL", "BT"] as const;
type Direction = (typeof DIRECTIONS)[number];

/** Arrow indicators for each direction */
const DIRECTION_ARROWS: Record<Direction, string> = {
  TD: "\u2193",
  LR: "\u2192",
  RL: "\u2190",
  BT: "\u2191",
};

/** Bracket pairs used in Mermaid node definitions */
const BRACKET_PAIRS: Array<[string, string]> = [
  ["([", "])"],  // stadium
  ["[[", "]]"],  // subroutine
  ["((", "))"],  // double circle
  ["{{", "}}"],  // hexagon (double curly - must come before single)
  ["{", "}"],    // rhombus
  ["[/", "/]"],  // parallelogram
  ["[\\", "\\]"], // parallelogram alt
  ["[/", "\\]"], // trapezoid
  ["[\\", "/]"], // trapezoid alt
  [">", "]"],    // asymmetric
  ["(", ")"],    // rounded
  ["[", "]"],    // rectangle
];

/** Extract a logical node ID from a Mermaid SVG element id attribute. */
function extractNodeId(rawId: string): string {
  // Flowchart nodes: "flowchart-NodeId-0" -> "NodeId"
  const flowMatch = rawId.match(/^flowchart-(.+)-\d+$/);
  if (flowMatch) return flowMatch[1];

  // State diagram nodes: "state-NodeId-0" or just the raw id
  const stateMatch = rawId.match(/^state-(.+?)(?:-\d+)?$/);
  if (stateMatch) return stateMatch[1];

  // Class diagram nodes: similar pattern
  const classMatch = rawId.match(/^classId-(.+?)(?:-\d+)?$/);
  if (classMatch) return classMatch[1];

  // Fallback: return the raw id
  return rawId;
}

/** Extract edge identifier from Mermaid SVG edge id/class. */
function extractEdgeId(el: SVGElement): string | null {
  const id = el.id || el.getAttribute("id");
  if (!id) return null;
  if (id.startsWith("L_") || id.startsWith("L-")) return id;
  if (id.startsWith("edge")) return id;
  return null;
}

/** Extract the text label from an SVG node group element. */
function extractNodeLabel(nodeEl: SVGGElement): string {
  // Mermaid v11 uses <foreignObject> with <span class="nodeLabel"> for most nodes
  const nodeLabelEls = nodeEl.querySelectorAll(".nodeLabel");
  if (nodeLabelEls.length > 0) {
    const texts: string[] = [];
    nodeLabelEls.forEach((el) => {
      const content = el.textContent?.trim();
      if (content) texts.push(content);
    });
    if (texts.length > 0) return texts.join(" ");
  }

  // Fallback: look for <text> elements (older Mermaid versions or some diagram types)
  const textEls = nodeEl.querySelectorAll("text");
  const texts: string[] = [];
  textEls.forEach((t) => {
    const content = t.textContent?.trim();
    if (content) texts.push(content);
  });
  return texts.join(" ") || "";
}

/**
 * Replace a node's label in Mermaid code.
 * Handles:
 * - Bracket types: A[Label], A(Label), A{Label}, A([Label]), etc. (flowchart)
 * - Mindmap: indentation-based lines where the text IS the node
 * - Other text-based diagram types
 */
function replaceNodeLabel(
  code: string,
  nodeId: string,
  oldLabel: string,
  newLabel: string,
): string {
  // Escape special regex chars in node ID
  const escapedId = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Strategy 1: Try bracket-based replacement (flowchart, state, class, etc.)
  for (const [open, close] of BRACKET_PAIRS) {
    const escapedOpen = open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedClose = close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match: nodeId + open bracket + content + close bracket
    const regex = new RegExp(
      `(${escapedId}\\s*)${escapedOpen}(.*?)${escapedClose}`,
    );
    if (regex.test(code)) {
      return code.replace(regex, `$1${open}${newLabel}${close}`);
    }
  }

  // Strategy 2: Fallback permissive bracket pattern
  const fallback = new RegExp(
    `(${escapedId}\\s*)(\\[\\[|\\(\\[|\\(\\(|\\{\\{|[\\[\\(\\{>])(.+?)(\\]\\]|\\]\\)|\\)\\)|\\}\\}|[\\]\\)\\}])`,
  );
  if (fallback.test(code)) {
    return code.replace(fallback, `$1$2${newLabel}$4`);
  }

  // Strategy 3: For mindmap / text-based diagrams, replace the old label text directly
  // Mindmap nodes are just lines of text with indentation, no brackets.
  // Find the line containing the old label and replace it.
  if (oldLabel) {
    const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match a line that contains exactly the old label (possibly with leading whitespace, emoji, etc.)
    const lineRegex = new RegExp(`^(\\s*)(.*${escapedOld}.*)$`, "m");
    const match = code.match(lineRegex);
    if (match) {
      const fullLine = match[2];
      const replaced = fullLine.replace(oldLabel, newLabel);
      return code.replace(lineRegex, `$1${replaced}`);
    }
  }

  return code;
}

/**
 * Extract the text label from an SVG edge label group element.
 * Mermaid v11 edge labels: <g class="edgeLabel"> containing <span class="edgeLabel"> or <text>.
 */
function extractEdgeLabelText(el: Element): string {
  // Mermaid v11: <foreignObject> > <div> > <span class="edgeLabel">
  const spanLabel = el.querySelector("span.edgeLabel");
  if (spanLabel?.textContent?.trim()) return spanLabel.textContent.trim();

  // Also check for .edgeLabel within nested structure
  const anyLabel = el.querySelector(".edgeLabel");
  if (anyLabel?.textContent?.trim()) return anyLabel.textContent.trim();

  // Fallback: <text> elements
  const textEls = el.querySelectorAll("text");
  const parts: string[] = [];
  textEls.forEach((t) => {
    const c = t.textContent?.trim();
    if (c) parts.push(c);
  });
  return parts.join(" ");
}

/**
 * Replace an edge label in Mermaid code.
 * Handles: A -->|old| B, A -.->|old| B, A ==>|old| B, A -- old --> B, etc.
 */
function replaceEdgeLabel(
  code: string,
  oldLabel: string,
  newLabel: string,
): string {
  if (!oldLabel) return code;
  const escapedOld = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Pattern 1: |old label| (pipe-delimited edge labels)
  const pipeRegex = new RegExp(`\\|${escapedOld}\\|`, "g");
  if (pipeRegex.test(code)) {
    return code.replace(pipeRegex, `|${newLabel}|`);
  }

  // Pattern 2: -- old label --> or -- old label --- (text between dashes and arrow)
  const dashRegex = new RegExp(`(--\\s*)${escapedOld}(\\s*-->)`, "g");
  if (dashRegex.test(code)) {
    return code.replace(dashRegex, `$1${newLabel}$2`);
  }

  // Fallback: direct text replacement (first occurrence only)
  const idx = code.indexOf(oldLabel);
  if (idx >= 0) {
    return code.substring(0, idx) + newLabel + code.substring(idx + oldLabel.length);
  }

  return code;
}

/**
 * Parse the current layout direction from Mermaid code.
 * Returns the direction if found, or null.
 */
function parseDirection(code: string): Direction | null {
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("%%")) continue;
    if (trimmed === "---") continue;
    // Match: graph/flowchart + optional space + direction
    const match = trimmed.match(/^(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)\b/i);
    if (match) {
      const dir = match[1].toUpperCase();
      // TB is alias for TD
      if (dir === "TB") return "TD";
      return dir as Direction;
    }
    // If we hit a non-comment, non-directive line that isn't a match, stop
    if (!trimmed.startsWith("%%{")) break;
  }
  return null;
}

/**
 * Replace the layout direction in Mermaid code.
 */
function replaceDirection(code: string, newDir: Direction): string {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("%%")) continue;
    if (trimmed === "---") continue;
    const match = trimmed.match(/^((?:graph|flowchart)\s+)(?:TD|TB|LR|RL|BT)\b/i);
    if (match) {
      lines[i] = lines[i].replace(
        /^(\s*(?:graph|flowchart)\s+)(?:TD|TB|LR|RL|BT)\b/i,
        `$1${newDir}`,
      );
      return lines.join("\n");
    }
    if (!trimmed.startsWith("%%{")) break;
  }
  return code;
}

/** Get the next direction in the cycle. */
function nextDirection(current: Direction): Direction {
  const idx = DIRECTIONS.indexOf(current);
  return DIRECTIONS[(idx + 1) % DIRECTIONS.length];
}

/** Inject selection highlight CSS into an SVG element. */
function injectSelectionStyles(svgEl: SVGSVGElement) {
  const existing = svgEl.querySelector("style[data-selection-styles]");
  if (existing) existing.remove();

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("data-selection-styles", "true");
  styleEl.textContent = `
    [data-selected="true"] > rect,
    [data-selected="true"] > circle,
    [data-selected="true"] > ellipse,
    [data-selected="true"] > polygon,
    [data-selected="true"] > path,
    [data-selected="true"] > .label-container {
      stroke: ${SELECTION_COLOR} !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
    }
    [data-selected="true"] > .outer,
    [data-selected="true"] > .inner {
      stroke: ${SELECTION_COLOR} !important;
      stroke-width: 3px !important;
    }
    path[data-selected="true"] {
      stroke: ${SELECTION_COLOR} !important;
      stroke-width: 3.5px !important;
      filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.5));
    }
    .node[data-selected="true"] {
      filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.4));
    }
    .node, .edgeLabel {
      cursor: pointer;
    }
  `;
  svgEl.insertBefore(styleEl, svgEl.firstChild);
}

/** Walk the SVG DOM and return maps of interactive elements. */
function findInteractiveElements(svgEl: SVGSVGElement): {
  nodes: Map<string, SVGGElement>;
  edges: Map<string, SVGElement>;
  edgeLabels: Map<string, SVGGElement>;
} {
  const nodes = new Map<string, SVGGElement>();
  const edges = new Map<string, SVGElement>();
  const edgeLabels = new Map<string, SVGGElement>();

  const nodeEls = svgEl.querySelectorAll<SVGGElement>("g.node");
  nodeEls.forEach((el) => {
    const rawId = el.id || el.getAttribute("id") || "";
    if (!rawId) return;
    const logicalId = extractNodeId(rawId);
    nodes.set(logicalId, el);
  });

  const edgePaths = svgEl.querySelectorAll<SVGPathElement>("path.flowchart-link");
  edgePaths.forEach((el) => {
    const edgeId = extractEdgeId(el);
    if (edgeId) edges.set(edgeId, el);
  });

  const edgeGroups = svgEl.querySelectorAll<SVGGElement>("g.edge, g.edgePath");
  edgeGroups.forEach((el) => {
    const edgeId = extractEdgeId(el);
    if (edgeId) edges.set(edgeId, el);
  });

  // Edge labels: <g class="edgeLabel"> elements
  const edgeLabelEls = svgEl.querySelectorAll<SVGGElement>("g.edgeLabel");
  edgeLabelEls.forEach((el) => {
    const labelText = extractEdgeLabelText(el);
    if (labelText) {
      // Use the label text as key since edge labels don't have reliable IDs
      edgeLabels.set(labelText, el);
    }
  });

  return { nodes, edges, edgeLabels };
}

/** Check if an element's bounding box intersects with a rectangle. */
function elementIntersectsRect(
  el: SVGElement,
  rect: { x: number; y: number; w: number; h: number },
  containerEl: HTMLDivElement,
  _pan: { x: number; y: number },
  _scale: number,
): boolean {
  const elRect = el.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  const elLocal = {
    left: elRect.left - containerRect.left,
    top: elRect.top - containerRect.top,
    right: elRect.right - containerRect.left,
    bottom: elRect.bottom - containerRect.top,
  };

  return !(
    elLocal.right < rect.x ||
    elLocal.left > rect.x + rect.w ||
    elLocal.bottom < rect.y ||
    elLocal.top > rect.y + rect.h
  );
}

/** Inline edit state — works for both node labels and edge labels. */
interface InlineEdit {
  /** "node" or "edge" */
  kind: "node" | "edge";
  /** Node ID (for node edits) or edge identifier like "A-->B" */
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function InteractiveDiagram({
  mermaidCode,
  theme,
  diagramType,
  selectedElements,
  onSelectionChange,
  onCodeChange,
  onRenderError,
}: InteractiveDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const marqueeJustFinished = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [renderError, setRenderError] = useState<string | null>(null);
  const colors = themeColors(theme);

  // Selection mode: off by default, toggled via floating toolbar
  const [selectionMode, setSelectionMode] = useState(false);

  // Refs for interactive elements discovered after render
  const nodesRef = useRef<Map<string, SVGGElement>>(new Map());
  const edgesRef = useRef<Map<string, SVGElement>>(new Map());
  const edgeLabelsRef = useRef<Map<string, SVGGElement>>(new Map());

  // Marquee state (only active in selection mode)
  const [marquee, setMarquee] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  // Inline edit state
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);

  // Keep selectionMode in ref for event handlers
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  // Toggle selection mode, clearing selection when turning off
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        // Exiting selection mode: clear selection
        onSelectionChange([]);
      }
      return !prev;
    });
  }, [onSelectionChange]);

  // Keep stable refs
  const selectedRef = useRef(selectedElements);
  selectedRef.current = selectedElements;
  const panRef = useRef(pan);
  panRef.current = pan;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const mermaidCodeRef = useRef(mermaidCode);
  mermaidCodeRef.current = mermaidCode;

  // Layout direction state
  const currentDirection = diagramType === "flowchart" ? parseDirection(mermaidCode) : null;
  const supportsDirection = currentDirection !== null;

  // --- Apply selection highlights to SVG DOM ---
  const applySelectionHighlights = useCallback(
    (selected: string[]) => {
      const svgEl = containerRef.current?.querySelector("svg");
      if (!svgEl) return;

      svgEl.querySelectorAll("[data-selected]").forEach((el) => {
        el.removeAttribute("data-selected");
      });

      for (const id of selected) {
        const nodeEl = nodesRef.current.get(id);
        if (nodeEl) nodeEl.setAttribute("data-selected", "true");
        const edgeEl = edgesRef.current.get(id);
        if (edgeEl) edgeEl.setAttribute("data-selected", "true");
      }
    },
    [],
  );

  // --- Post-process SVG after Mermaid render ---
  const postProcessSvg = useCallback(() => {
    const svgEl = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svgEl) return;

    injectSelectionStyles(svgEl);

    const { nodes, edges, edgeLabels } = findInteractiveElements(svgEl);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    edgeLabelsRef.current = edgeLabels;

    applySelectionHighlights(selectedRef.current);
  }, [applySelectionHighlights]);

  // Clean up any leaked Mermaid error/temp elements from the body
  const cleanupMermaidLeaks = useCallback(() => {
    // Mermaid creates temp elements with id starting with "d" or "mermaid-"
    // and error elements with class "error-icon", "error-text"
    document.querySelectorAll(
      'body > [id^="dmermaid"], body > [id^="mermaid-interactive"], body > svg[id^="mermaid"], body > .error-icon, body > .error-text'
    ).forEach((el) => el.remove());
    // Also clean up any orphaned Mermaid error SVGs (they have the bomb icon)
    document.querySelectorAll('body > svg[aria-roledescription="error"]').forEach((el) => el.remove());
    // Generic cleanup: any Mermaid-generated SVG that leaked to body
    document.querySelectorAll('body > svg:not([data-keep])').forEach((el) => {
      if (el.querySelector('.error-icon') || el.getAttribute('aria-roledescription') === 'error') {
        el.remove();
      }
    });
  }, []);

  // Render Mermaid SVG when code or theme changes
  useEffect(() => {
    if (!containerRef.current || !mermaidCode.trim()) return;

    let cancelled = false;
    const id = `mermaid-interactive-${++renderCounter}`;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: mermaidTheme(theme) as "default" | "dark" | "forest" | "neutral",
      suppressErrorRendering: true,
    });

    mermaid
      .render(id, mermaidCode)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setRenderError(null);
        onRenderError?.(null);
        postProcessSvg();
        cleanupMermaidLeaks();
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setRenderError(msg);
        onRenderError?.(msg);
        cleanupMermaidLeaks();
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidCode, theme, postProcessSvg, cleanupMermaidLeaks]);

  // Re-apply highlights whenever selectedElements changes
  useEffect(() => {
    applySelectionHighlights(selectedElements);
  }, [selectedElements, applySelectionHighlights]);

  // Reset view when diagram type changes significantly
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [diagramType]);

  // Focus the inline edit input when it appears
  useEffect(() => {
    if (inlineEdit && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inlineEdit]);

  // --- Double-click handler: open inline edit for nodes OR edge labels ---
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!wrapperRef.current) return;

      const target = e.target as Element;
      let current: Element | null = target;
      let nodeGroup: SVGGElement | null = null;
      let edgeLabelGroup: SVGGElement | null = null;

      // Walk up to find a .node or .edgeLabel element
      while (current && current !== containerRef.current) {
        if (current instanceof SVGGElement) {
          if (current.classList.contains("node")) {
            nodeGroup = current;
            break;
          }
          if (current.classList.contains("edgeLabel")) {
            edgeLabelGroup = current;
            break;
          }
        }
        current = current.parentElement;
      }

      const wrapperRect = wrapperRef.current.getBoundingClientRect();

      if (nodeGroup) {
        const rawId = nodeGroup.id || nodeGroup.getAttribute("id") || "";
        if (!rawId) return;
        const nodeId = extractNodeId(rawId);
        const label = extractNodeLabel(nodeGroup);
        const nodeRect = nodeGroup.getBoundingClientRect();

        setInlineEdit({
          kind: "node",
          id: nodeId,
          label,
          x: nodeRect.left - wrapperRect.left,
          y: nodeRect.top - wrapperRect.top,
          width: Math.max(nodeRect.width, 80),
          height: nodeRect.height,
        });
        e.stopPropagation();
      } else if (edgeLabelGroup) {
        const label = extractEdgeLabelText(edgeLabelGroup);
        if (!label) return;
        const elRect = edgeLabelGroup.getBoundingClientRect();

        setInlineEdit({
          kind: "edge",
          id: label, // use the label text as identifier
          label,
          x: elRect.left - wrapperRect.left,
          y: elRect.top - wrapperRect.top,
          width: Math.max(elRect.width, 80),
          height: Math.max(elRect.height, 28),
        });
        e.stopPropagation();
      }
    },
    [],
  );

  // --- Confirm inline edit (node or edge label) ---
  const confirmEdit = useCallback(() => {
    if (!inlineEdit) return;

    const newLabel = inputRef.current?.value.trim();
    if (newLabel && newLabel !== inlineEdit.label) {
      let updatedCode: string;

      if (inlineEdit.kind === "node") {
        updatedCode = replaceNodeLabel(
          mermaidCodeRef.current,
          inlineEdit.id,
          inlineEdit.label,
          newLabel,
        );
      } else {
        // Edge label edit
        updatedCode = replaceEdgeLabel(
          mermaidCodeRef.current,
          inlineEdit.label,
          newLabel,
        );
      }

      if (updatedCode !== mermaidCodeRef.current) {
        onCodeChange(updatedCode, {
          type: "rename",
          nodeId: inlineEdit.id,
          oldLabel: inlineEdit.label,
          newLabel,
        });
      }
    }

    setInlineEdit(null);
  }, [inlineEdit, onCodeChange]);

  // --- Cancel inline edit ---
  const cancelEdit = useCallback(() => {
    setInlineEdit(null);
  }, []);

  // --- Inline edit key handler ---
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [confirmEdit, cancelEdit],
  );

  // --- Layout direction toggle ---
  const handleDirectionToggle = useCallback(() => {
    if (!currentDirection) return;
    const next = nextDirection(currentDirection);
    const updatedCode = replaceDirection(mermaidCodeRef.current, next);
    if (updatedCode !== mermaidCodeRef.current) {
      onCodeChange(updatedCode, {
        type: "layout-change",
        oldDirection: currentDirection,
        newDirection: next,
      });
    }
  }, [currentDirection, onCodeChange]);

  // --- Click handler: only selects in selection mode ---
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If inline edit is open and user clicks elsewhere, confirm it
      if (inlineEdit) {
        confirmEdit();
        return;
      }

      // If a drag or marquee just happened, don't treat mouseup as a click
      if (dragMoved.current) return;
      if (marqueeJustFinished.current) {
        marqueeJustFinished.current = false;
        return;
      }

      // Selection only works in selection mode
      if (!selectionModeRef.current) return;

      const target = e.target as SVGElement;

      let current: Element | null = target;
      let clickedNodeId: string | null = null;
      let clickedEdgeId: string | null = null;

      while (current && current !== containerRef.current) {
        if (current instanceof SVGGElement && current.classList.contains("node")) {
          const rawId = current.id || current.getAttribute("id") || "";
          if (rawId) clickedNodeId = extractNodeId(rawId);
          break;
        }
        if (
          current instanceof SVGPathElement &&
          current.classList.contains("flowchart-link")
        ) {
          clickedEdgeId = extractEdgeId(current);
          break;
        }
        if (current instanceof SVGGElement && (current.classList.contains("edge") || current.classList.contains("edgePath"))) {
          clickedEdgeId = extractEdgeId(current);
          break;
        }
        current = current.parentElement;
      }

      const clickedId = clickedNodeId || clickedEdgeId;

      if (clickedId) {
        // Toggle: click adds/removes from selection
        const alreadySelected = selectedRef.current.includes(clickedId);
        if (alreadySelected) {
          onSelectionChange(selectedRef.current.filter((id) => id !== clickedId));
        } else {
          onSelectionChange([...selectedRef.current, clickedId]);
        }
      } else {
        // Click on empty area: clear all selections
        if (selectedRef.current.length > 0) {
          onSelectionChange([]);
        }
      }
    },
    [onSelectionChange, inlineEdit, confirmEdit],
  );

  // --- Pan/Zoom handlers ---

  // Use native wheel event listener with { passive: false } to prevent scroll leak
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)));
    };

    wrapper.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => {
      wrapper.removeEventListener("wheel", handleWheelNative);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Don't start pan/marquee if inline edit input is focused
      if (inlineEdit) return;

      const target = e.target as Element;

      // In selection mode: drag on empty area = marquee
      if (selectionModeRef.current) {
        let current: Element | null = target;
        let onNode = false;
        while (current && current !== wrapperRef.current) {
          if (current instanceof SVGGElement &&
            (current.classList.contains("node") || current.classList.contains("edgeLabel"))) {
            onNode = true;
            break;
          }
          current = current.parentElement;
        }

        if (!onNode && wrapperRef.current) {
          const wrapperRect = wrapperRef.current.getBoundingClientRect();
          const startX = e.clientX - wrapperRect.left;
          const startY = e.clientY - wrapperRect.top;
          setMarquee({
            active: true,
            startX,
            startY,
            currentX: startX,
            currentY: startY,
          });
          e.preventDefault();
          return;
        }
      }

      // Default mode (or clicked on a node in selection mode): pan
      dragging.current = true;
      dragMoved.current = false;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    },
    [inlineEdit],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (marqueeRef.current?.active && wrapperRef.current) {
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        setMarquee((prev) =>
          prev
            ? {
                ...prev,
                currentX: e.clientX - wrapperRect.left,
                currentY: e.clientY - wrapperRect.top,
              }
            : null,
        );
        return;
      }

      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }

      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    },
    [],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (marqueeRef.current?.active && wrapperRef.current && containerRef.current) {
        const m = marqueeRef.current;
        const rect = {
          x: Math.min(m.startX, m.currentX),
          y: Math.min(m.startY, m.currentY),
          w: Math.abs(m.currentX - m.startX),
          h: Math.abs(m.currentY - m.startY),
        };

        if (rect.w > 5 && rect.h > 5) {
          const selected: string[] = [];
          nodesRef.current.forEach((el, id) => {
            if (
              elementIntersectsRect(
                el,
                rect,
                wrapperRef.current!,
                panRef.current,
                scaleRef.current,
              )
            ) {
              selected.push(id);
            }
          });

          if (e.shiftKey && selectedRef.current.length > 0) {
            const merged = new Set([...selectedRef.current, ...selected]);
            onSelectionChange(Array.from(merged));
          } else {
            onSelectionChange(selected);
          }
        }

        setMarquee(null);
        marqueeJustFinished.current = true;
        return;
      }

      dragging.current = false;
    },
    [onSelectionChange],
  );

  const handleMouseLeave = useCallback(() => {
    dragging.current = false;
    if (marqueeRef.current?.active) {
      setMarquee(null);
    }
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Calculate marquee display rect
  const marqueeRect = marquee?.active
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        cursor: marquee?.active
          ? "crosshair"
          : selectionMode
            ? "default"
            : dragging.current
              ? "grabbing"
              : "grab",
        backgroundColor: colors.canvasBg,
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* SVG container with pan/zoom transform */}
      <div
        ref={containerRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100%",
          padding: 24,
        }}
      />

      {/* Marquee selection overlay */}
      {marqueeRect && (
        <div
          style={{
            position: "absolute",
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            border: `2px dashed ${SELECTION_COLOR}`,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* Inline text edit overlay */}
      {inlineEdit && (
        <input
          ref={inputRef}
          defaultValue={inlineEdit.label}
          onKeyDown={handleEditKeyDown}
          onBlur={confirmEdit}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: inlineEdit.x,
            top: inlineEdit.y,
            width: inlineEdit.width,
            height: inlineEdit.height,
            minWidth: 80,
            zIndex: 20,
            border: `2px solid ${SELECTION_COLOR}`,
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 14,
            textAlign: "center",
            backgroundColor: theme === "dark" ? "#2d3748" : "#ffffff",
            color: theme === "dark" ? "#e2e8f0" : "#1a202c",
            outline: "none",
            boxShadow: `0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.15)`,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Selection count indicator - top right */}
      {selectedElements.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: SELECTION_COLOR,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 12,
            zIndex: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {selectedElements.length} selected
        </div>
      )}

      {/* Zoom controls + layout toggle toolbar - bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          display: "flex",
          gap: 4,
          background: colors.zoomBg,
          border: `1px solid ${colors.zoomBorder}`,
          borderRadius: 6,
          padding: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setScale((s) => Math.max(0.1, s * 0.85))}
          style={{ ...zoomBtnStyle, color: colors.zoomText }}
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={resetView}
          style={{ ...zoomBtnStyle, minWidth: 48, fontSize: 11, color: colors.zoomText }}
          title="Reset view"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale((s) => Math.min(5, s * 1.15))}
          style={{ ...zoomBtnStyle, color: colors.zoomText }}
          title="Zoom in"
        >
          +
        </button>

        {/* Layout direction toggle - only for flowcharts */}
        {supportsDirection && currentDirection && (
          <>
            <div
              style={{
                width: 1,
                backgroundColor: colors.zoomBorder,
                margin: "2px 2px",
              }}
            />
            <button
              onClick={handleDirectionToggle}
              style={{
                ...zoomBtnStyle,
                fontSize: 11,
                fontWeight: 600,
                minWidth: 36,
                color: colors.zoomText,
              }}
              title={`Layout direction: ${currentDirection} (click to cycle)`}
            >
              {DIRECTION_ARROWS[currentDirection]} {currentDirection}
            </button>
          </>
        )}

        {/* Selection mode toggle */}
        <div
          style={{
            width: 1,
            backgroundColor: colors.zoomBorder,
            margin: "2px 2px",
          }}
        />
        <button
          onClick={toggleSelectionMode}
          style={{
            ...zoomBtnStyle,
            color: selectionMode ? "#fff" : colors.zoomText,
            backgroundColor: selectionMode ? SELECTION_COLOR : "transparent",
            borderRadius: 4,
            transition: "background-color 0.15s, color 0.15s",
          }}
          title={selectionMode ? "Exit selection mode" : "Enter selection mode"}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="10" height="10" strokeDasharray="3 2" />
            <path d="M6 6L9 12L10.5 9L13.5 7.5L6 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>

      {/* Mode hint - bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 11,
          color: selectionMode ? SELECTION_COLOR : colors.toolbarLabel,
          opacity: selectionMode ? 0.9 : 0.7,
          zIndex: 10,
          fontWeight: selectionMode ? 500 : 400,
        }}
      >
        {selectionMode ? "Click to select \u00B7 Drag to box select" : "Double-click to edit"}
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
  padding: "4px 8px",
  lineHeight: 1,
  borderRadius: 4,
};
