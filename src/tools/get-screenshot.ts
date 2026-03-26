import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../lookin-client.js";

export const getScreenshotTool: Tool = {
  name: "lookin_get_screenshot",
  description:
    "获取指定视图的截图（PNG 格式，base64 编码）。" +
    "需要先通过 lookin_get_hierarchy 获取目标视图的 oid。" +
    "截图来自 Lookin 已加载的视图树数据，无需重新连接设备。" +
    "返回 imageBase64 字段为 base64 编码的 PNG 图片数据。",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description: "目标视图的 object ID（从 lookin_get_hierarchy 的 oid 字段获取）",
      },
    },
    required: ["oid"],
  },
};

export async function handleGetScreenshot(args: {
  oid: number;
}): Promise<Array<{ type: string; data?: string; mimeType?: string; text?: string }>> {
  const result = await lookinClient.getScreenshot(args.oid);

  if (!result.imageBase64) {
    return [{ type: "text", text: "Screenshot not available for this view." }];
  }

  // MCP image content 格式
  return [
    {
      type: "image",
      data: result.imageBase64,
      mimeType: result.mimeType ?? "image/png",
    },
    {
      type: "text",
      text: `Screenshot captured: ${result.width}×${result.height}px`,
    },
  ];
}
