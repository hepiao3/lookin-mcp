#!/usr/bin/env node
/**
 * Lookin MCP Server
 *
 * Implements MCP protocol via stdio, directly connects to LookinServer (127.0.0.1:47190),
 * allowing Claude Code to directly access iOS App UI view information:
 * - lookin_get_hierarchy: get iOS App view hierarchy tree
 * - lookin_get_attributes: query UI attributes of a specified view
 * - lookin_get_screenshot: get view screenshot (real-time rendering)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getHierarchyTool, handleGetHierarchy } from "./tools/get-hierarchy.js";
import { getAttributesTool, handleGetAttributes } from "./tools/get-attributes.js";
import { getScreenshotTool, handleGetScreenshot } from "./tools/get-screenshot.js";
import { listDevicesTool, handleListDevices } from "./tools/list-devices.js";
import { connectDeviceTool, handleConnectDevice } from "./tools/connect-device.js";
import { deviceManager } from "./device-manager.js";

// ──────────────────────────────────────────────────────────────
// Server setup
// ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "lookin-mcp-server",
    version: "1.0.2",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ──────────────────────────────────────────────────────────────
// List tools
// ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    getHierarchyTool,
    getAttributesTool,
    getScreenshotTool,
    listDevicesTool,
    connectDeviceTool,
  ],
}));

// ──────────────────────────────────────────────────────────────
// Call tool
// ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // For view tools, check if the user needs to select a device first
    const viewTools = ["lookin_get_hierarchy", "lookin_get_attributes", "lookin_get_screenshot"];
    if (viewTools.includes(name) && deviceManager.needsDeviceSelection()) {
      const devices = await deviceManager.listDevices();
      const deviceList = devices
        .map((d) => `- ${d.name} (${d.type}) — UDID: ${d.udid}`)
        .join("\n");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "multiple_devices",
            message: "Multiple devices detected. Please use lookin_connect_device to select a device before viewing page information.",
            availableDevices: devices,
            hint: `Available devices:\n${deviceList}`,
          }),
        }],
      };
    }

    switch (name) {
      case "lookin_get_hierarchy": {
        const text = await handleGetHierarchy(
          args as { includeSystemViews?: boolean; maxDepth?: number }
        );
        return { content: [{ type: "text", text }] };
      }

      case "lookin_get_attributes": {
        const text = await handleGetAttributes(args as { oid: number });
        return { content: [{ type: "text", text }] };
      }

      case "lookin_get_screenshot": {
        const content = await handleGetScreenshot(args as { oid?: number });
        return { content };
      }

      case "lookin_list_devices": {
        const text = await handleListDevices();
        return { content: [{ type: "text", text }] };
      }

      case "lookin_connect_device": {
        const text = await handleConnectDevice(args as { target: string });
        return { content: [{ type: "text", text }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ──────────────────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Clean up iproxy subprocess on exit
  process.on("exit", () => { deviceManager.shutdown(); });
  process.on("SIGINT", async () => { await deviceManager.shutdown(); process.exit(0); });
  process.on("SIGTERM", async () => { await deviceManager.shutdown(); process.exit(0); });

  process.stderr.write("[lookin-mcp-server] Server started (LookinServer :47190)\n");

  // Auto-connect if exactly 1 device is available
  deviceManager.autoConnect().catch(() => { /* non-fatal */ });
}

main().catch((err) => {
  process.stderr.write(`[lookin-mcp-server] Fatal error: ${err}\n`);
  process.exit(1);
});
