import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.join(import.meta.dirname, "..", "..", "dist");

function createServer(): McpServer {
  const server = new McpServer({
    name: "mermaid-app",
    version: "0.1.0",
  });

  const resourceUri = "ui://mermaid-app/index.html";

  registerAppTool(
    server,
    "mermaid_diagram",
    {
      title: "Mermaid Diagram",
      description:
        "Render and edit Mermaid diagrams interactively. Generates a visual diagram from Mermaid syntax code.",
      inputSchema: {
        mermaidCode: z.string().describe("Mermaid diagram code to render"),
        diagramType: z
          .string()
          .describe(
            "Diagram type hint: flowchart, sequence, classDiagram, erDiagram, stateDiagram, gantt, pie, mindmap, timeline, etc.",
          ),
      },
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ mermaidCode, diagramType }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered ${diagramType ?? "unknown"} diagram (${mermaidCode.length} chars)`,
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "index.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
