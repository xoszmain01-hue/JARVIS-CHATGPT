import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const jarvisHtml = readFileSync("jarvis.html", "utf8");

function createJarvisServer() {
  const server = new McpServer({
    name: "jarvis-chatgpt",
    version: "1.0.0",
  });

  registerAppResource(
    server,
    "jarvis-ui",
    "ui://widget/jarvis.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/jarvis.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: jarvisHtml,
        },
      ],
    })
  );

  registerAppTool(
    server,
    "open_jarvis",
    {
      title: "Open JARVIS",
      description:
        "Opens the JARVIS futuristic assistant interface inside ChatGPT.",
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: "ui://widget/jarvis.html",
        },
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "JARVIS interface activated.",
        },
      ],
    })
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host ?? "localhost"}`
  );

  // CORS preflight
  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, {
      "content-type": "text/plain",
    });
    res.end("JARVIS MCP server is running.");
    return;
  }

  // MCP endpoint
  const allowedMethods = new Set(["POST", "GET", "DELETE"]);

  if (
    url.pathname === MCP_PATH &&
    req.method &&
    allowedMethods.has(req.method)
  ) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Mcp-Session-Id"
    );

    const server = createJarvisServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP error:", error);

      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }

    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(
    `JARVIS MCP server listening on port ${port}${MCP_PATH}`
  );
});
