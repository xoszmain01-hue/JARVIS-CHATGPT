import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import OpenAI from "openai";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";


// ============================================
// JARVIS CONFIGURATION
// ============================================

const jarvisHtml = readFileSync("jarvis.html", "utf8");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ============================================
// HELPER: SEND JSON
// ============================================

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });

  res.end(JSON.stringify(data));
}


// ============================================
// HELPER: READ REQUEST BODY
// ============================================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1000000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}


// ============================================
// JARVIS MCP SERVER
// ============================================

function createJarvisServer() {
  const server = new McpServer({
    name: "jarvis-chatgpt",
    version: "2.0.0",
  });


  // JARVIS UI
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


  // OPEN JARVIS TOOL
  registerAppTool(
    server,
    "open_jarvis",
    {
      title: "Open JARVIS",

      description:
        "Opens the futuristic JARVIS AI assistant interface.",

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


// ============================================
// HTTP SERVER
// ============================================

const port = Number(
  process.env.PORT ?? 8787
);

const MCP_PATH = "/mcp";


const httpServer = createServer(
  async (req, res) => {

    if (!req.url) {
      res.writeHead(400);
      res.end("Missing URL");
      return;
    }


    const url = new URL(
      req.url,
      `http://${req.headers.host ?? "localhost"}`
    );


    // ========================================
    // CORS
    // ========================================

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS"
    );


    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }


    // ========================================
    // HEALTH CHECK
    // ========================================

    if (
      req.method === "GET" &&
      url.pathname === "/"
    ) {

      res.writeHead(200, {
        "Content-Type": "text/plain",
      });

      res.end(
        "JARVIS AI server is running."
      );

      return;
    }


    // ========================================
    // AI CHAT
    // ========================================

    if (
      req.method === "POST" &&
      url.pathname === "/api/chat"
    ) {

      try {

        if (!process.env.OPENAI_API_KEY) {

          sendJSON(res, 500, {
            error:
              "OPENAI_API_KEY is not configured on Render.",
          });

          return;
        }


        const body = await readBody(req);

        const message =
          String(body.message || "").trim();


        if (!message) {

          sendJSON(res, 400, {
            error: "Message is required.",
          });

          return;
        }


        console.log(
          "JARVIS USER:",
          message
        );


        // ==================================
        // OPENAI RESPONSE
        // ==================================

        const response =
          await openai.responses.create({

            model: "gpt-5.6-luna",

            instructions:
              "You are JARVIS, a futuristic AI assistant. " +
              "Be intelligent, helpful, concise and friendly. " +
              "Speak naturally like a sophisticated personal assistant. " +
              "Never claim to control a device or perform an action " +
              "unless that capability is actually available.",

            input: message,

            max_output_tokens: 500,
          });


        const reply =
          response.output_text ||
          "I could not generate a response.";


        console.log(
          "JARVIS:",
          reply
        );


        sendJSON(res, 200, {
          reply: reply,
        });


      } catch (error) {

        console.error(
          "JARVIS AI ERROR:",
          error
        );


        sendJSON(res, 500, {
          error:
            "JARVIS AI could not process your request.",
        });
      }


      return;
    }


    // ========================================
    // TEXT TO SPEECH
    // ========================================

    if (
      req.method === "POST" &&
      url.pathname === "/api/speech"
    ) {

      try {

        if (!process.env.OPENAI_API_KEY) {

          sendJSON(res, 500, {
            error:
              "OPENAI_API_KEY is not configured.",
          });

          return;
        }


        const body = await readBody(req);

        const text =
          String(body.text || "").trim();


        if (!text) {

          sendJSON(res, 400, {
            error: "Text is required.",
          });

          return;
        }


        const speech =
          await openai.audio.speech.create({

            model: "tts-1",

            voice: "onyx",

            input: text.slice(0, 4096),

            response_format: "mp3",
          });


        const audioBuffer =
          Buffer.from(
            await speech.arrayBuffer()
          );


        res.writeHead(200, {

          "Content-Type":
            "audio/mpeg",

          "Content-Length":
            audioBuffer.length,

          "Access-Control-Allow-Origin":
            "*",
        });


        res.end(audioBuffer);


      } catch (error) {

        console.error(
          "JARVIS VOICE ERROR:",
          error
        );


        sendJSON(res, 500, {
          error:
            "JARVIS voice generation failed.",
        });
      }


      return;
    }


    // ========================================
    // MCP ENDPOINT
    // ========================================

    const allowedMethods =
      new Set([
        "POST",
        "GET",
        "DELETE",
      ]);


    if (
      url.pathname === MCP_PATH &&
      req.method &&
      allowedMethods.has(req.method)
    ) {

      res.setHeader(
        "Access-Control-Expose-Headers",
        "Mcp-Session-Id"
      );


      const server =
        createJarvisServer();


      const transport =
        new StreamableHTTPServerTransport({

          sessionIdGenerator:
            undefined,

          enableJsonResponse:
            true,
        });


      res.on("close", () => {

        transport.close();

        server.close();

      });


      try {

        await server.connect(
          transport
        );

        await transport.handleRequest(
          req,
          res
        );


      } catch (error) {

        console.error(
          "MCP ERROR:",
          error
        );


        if (!res.headersSent) {

          res.writeHead(500);

          res.end(
            "Internal server error"
          );
        }
      }


      return;
    }


    // ========================================
    // 404
    // ========================================

    res.writeHead(404);

    res.end("Not Found");
  }
);


// ============================================
// START JARVIS
// ============================================

httpServer.listen(
  port,
  () => {

    console.log(
      `JARVIS AI server running on port ${port}`
    );

  }
);
