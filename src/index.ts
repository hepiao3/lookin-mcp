#!/usr/bin/env node
/**
 * Lookin MCP Server
 *
 * 通过 stdio 实现 MCP 协议，直连 LookinServer（127.0.0.1:47190），
 * 让 Claude Code 能直接访问 iOS App 的 UI 视图信息：
 * - lookin_get_hierarchy：获取 iOS App 视图层级树
 * - lookin_get_attributes：查询指定视图的 UI 属性
 * - lookin_get_screenshot：获取视图截图（实时渲染）
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
            message: "检测到多台设备，请先使用 lookin_connect_device 选择一台设备后再查看页面信息。",
            availableDevices: devices,
            hint: `可用设备：\n${deviceList}`,
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
