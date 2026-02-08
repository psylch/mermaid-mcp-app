/**
 * Detect Mermaid diagram type from code.
 *
 * Returns the canonical diagram type string.
 * Interactive types (flowchart, stateDiagram, classDiagram, erDiagram) use DiagramCanvas.
 * All other types use read-only Mermaid native rendering.
 */

/** Diagram types that support interactive editing via DiagramCanvas. */
const INTERACTIVE_TYPES = new Set([
  "flowchart",
  "graph",
  "stateDiagram",
  "stateDiagram-v2",
  "classDiagram",
  "classDiagram-v2",
  "erDiagram",
  "er",
]);

/**
 * Detect diagram type from Mermaid code by parsing the first directive line.
 * Returns the type keyword (e.g. "flowchart", "sequenceDiagram", "pie").
 */
export function detectDiagramType(code: string): string {
  const trimmed = code.trim();

  // Skip frontmatter (---...---) and directives (%%{...}%%)
  const lines = trimmed.split("\n");
  let i = 0;

  // Skip YAML frontmatter
  if (lines[0]?.trim() === "---") {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") i++;
    i++; // skip closing ---
  }

  // Skip directive lines
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("%%{") || line.startsWith("%%")) {
      i++;
      continue;
    }
    break;
  }

  if (i >= lines.length) return "unknown";

  const firstLine = lines[i].trim();

  // Match known diagram type keywords
  const typeMatch = firstLine.match(
    /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph|journey|quadrantChart|sankey|xychart|block|architecture|packet|kanban|requirement|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i,
  );

  if (typeMatch) {
    // Normalize: "graph" -> "flowchart" for routing purposes
    const raw = typeMatch[1];
    if (raw.toLowerCase() === "graph") return "flowchart";
    // Preserve casing for mermaid (e.g. "sequenceDiagram")
    return raw;
  }

  return "unknown";
}

/**
 * Check if a diagram type supports interactive editing via DiagramCanvas.
 */
export function isInteractiveType(diagramType: string): boolean {
  return INTERACTIVE_TYPES.has(diagramType);
}
