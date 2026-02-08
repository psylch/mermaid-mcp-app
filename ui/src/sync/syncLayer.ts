/**
 * Sync Layer: manages LLM communication via the MCP Apps protocol.
 *
 * Two channels:
 * 1. silentSync (updateModelContext) -- fires on semantic changes (debounced),
 *    keeps AI context up-to-date without triggering a response.
 * 2. sendToAgent (sendMessage) -- fires on user button click, sends delta
 *    changes + full state, triggers AI response.
 */

import type { App as McpApp } from "@modelcontextprotocol/ext-apps/react";
import type { ChangeLog } from "./changeLog";

/**
 * Silent sync: push current diagram state to AI context.
 * Does NOT trigger an AI response.
 */
export function silentSync(
  app: McpApp | null,
  mermaidCode: string,
  selectedElements: string[],
  diagramType: string,
): void {
  if (!app) return;

  const selectionText = selectedElements.length > 0
    ? selectedElements.join(", ")
    : "none";

  const text = [
    `Current diagram type: ${diagramType}`,
    `Selected elements: ${selectionText}`,
    "",
    "Diagram code:",
    mermaidCode,
  ].join("\n");

  try {
    app.updateModelContext({
      content: [{ type: "text", text }],
    });
  } catch {
    // updateModelContext may not be available in all hosts / standalone mode
  }
}

/**
 * Send to Agent: send delta changes + full state to AI.
 * DOES trigger an AI response.
 */
export function sendToAgent(
  app: McpApp | null,
  changeLog: ChangeLog,
  mermaidCode: string,
  selectedElements: string[],
  diagramType: string,
): void {
  if (!app) return;

  const delta = changeLog.serialize();
  const selectionText = selectedElements.length > 0
    ? selectedElements.join(", ")
    : "none";

  const parts: string[] = [];

  if (delta) {
    parts.push("User edited the diagram:");
    parts.push(delta);
  }

  parts.push(`Currently selected: ${selectionText}`);
  parts.push("");
  parts.push(`Full diagram code (${diagramType}):`);
  parts.push(mermaidCode);

  const text = parts.join("\n");

  try {
    app.sendMessage({
      role: "user",
      content: [{ type: "text", text }],
    });
  } catch {
    // sendMessage may not be available in standalone mode
  }

  changeLog.clear();
}
