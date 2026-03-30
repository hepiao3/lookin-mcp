import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../client.js";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function copyImageToClipboard(base64: string): void {
  const tmpFile = join(tmpdir(), `lookin_screenshot_${Date.now()}.png`);
  try {
    writeFileSync(tmpFile, Buffer.from(base64, "base64"));
    execSync(`osascript -e 'set the clipboard to (read (POSIX file "${tmpFile}") as «class PNGf»)'`);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

export const getScreenshotTool: Tool = {
  name: "lookin_get_screenshot",
  description:
    "获取指定视图的截图（PNG 格式，base64 编码）。" +
    "oid 可选，不传时自动截取根视图（window）全屏截图。" +
    "每次调用都会从 iOS App 实时渲染，无需提前刷新缓存。" +
    "返回 imageBase64 字段为 base64 编码的 PNG 图片数据。",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "目标视图的 object ID（从 lookin_get_hierarchy 的 oid 字段获取）。不传则默认使用根视图（window）。",
      },
    },
  },
};

export async function handleGetScreenshot(
  args: { oid?: number }
): Promise<Array<{ type: string; data?: string; mimeType?: string; text?: string }>> {
  let oid = args.oid;
  if (oid === undefined) {
    const hierarchy = await lookinClient.getHierarchy();
    const root = hierarchy.items[0];
    if (!root) {
      return [{ type: "text", text: "No views found in hierarchy." }];
    }
    oid = root.oid;
  }
  const result = await lookinClient.getScreenshot(oid);

  if (!result.imageBase64) {
    return [{ type: "text", text: "Screenshot not available for this view." }];
  }

  let clipboardNote = " (copied to clipboard)";
  try {
    copyImageToClipboard(result.imageBase64);
  } catch {
    clipboardNote = " (clipboard copy failed)";
  }

  return [
    {
      type: "image",
      data: result.imageBase64,
      mimeType: result.mimeType ?? "image/png",
    },
    {
      type: "text",
      text: `Screenshot captured: ${result.width}×${result.height}px${clipboardNote}`,
    },
  ];
}
