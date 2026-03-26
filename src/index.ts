#!/usr/bin/env node
/**
 * Lookin MCP Server
 *
 * 通过 stdio 实现 MCP 协议，让 Claude Code 能调用 Lookin 的 UI 调试能力：
 * - lookin_get_hierarchy：获取 iOS App 视图层级树
 * - lookin_get_attributes：查询指定视图的 UI 属性
 * - lookin_modify_attribute：修改视图属性（实时生效）
 * - lookin_get_screenshot：获取视图截图
 * - lookin_invoke_method：调用对象方法
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getHierarchyTool, handleGetHierarchy } from "./tools/get-hierarchy.js";
import { getAttributesTool, handleGetAttributes } from "./tools/get-attributes.js";
import { modifyAttributeTool, handleModifyAttribute } from "./tools/modify-attribute.js";
import { getScreenshotTool, handleGetScreenshot } from "./tools/get-screenshot.js";
import { invokeMethodTool, handleInvokeMethod } from "./tools/invoke-method.js";

// ──────────────────────────────────────────────────────────────
// Server setup
// ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "lookin-mcp-server",
    version: "1.0.0",
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
    modifyAttributeTool,
    getScreenshotTool,
    invokeMethodTool,
  ],
}));

// ──────────────────────────────────────────────────────────────
// Call tool
// ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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

      case "lookin_modify_attribute": {
        const text = await handleModifyAttribute(
          args as {
            oid: number;
            setterSelector: string;
            attrType: number;
            value: unknown;
          }
        );
        return { content: [{ type: "text", text }] };
      }

      case "lookin_get_screenshot": {
        const content = await handleGetScreenshot(args as { oid: number });
        return { content };
      }

      case "lookin_invoke_method": {
        const text = await handleInvokeMethod(
          args as { oid: number; method: string }
        );
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
  process.stderr.write("[lookin-mcp-server] Server started\n");
}

main().catch((err) => {
  process.stderr.write(`[lookin-mcp-server] Fatal error: ${err}\n`);
  process.exit(1);
});
