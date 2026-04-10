import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../client.js";

export const getScreenshotTool: Tool = {
  name: "lookin_get_screenshot",
  description:
    "Get a screenshot of the specified view (PNG format, base64 encoded). " +
    "oid is optional. If not provided, automatically takes a full-screen screenshot of the root view (window). " +
    "Each call is rendered in real-time from the iOS app, no need to refresh cache in advance. " +
    "Returns imageBase64 field containing base64-encoded PNG image data.",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "Object ID of the target view (get from lookin_get_hierarchy's oid field). If not provided, defaults to using the root view (window).",
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
