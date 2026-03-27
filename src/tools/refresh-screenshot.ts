import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../lookin-client.js";

export const refreshScreenshotTool: Tool = {
  name: "lookin_refresh_screenshot",
  description:
    "从 iOS 设备重新拉取指定视图的截图，更新 Lookin 本地缓存。" +
    "在调用 lookin_modify_attribute 修改属性后，应先调用此工具刷新截图，再调用 lookin_get_screenshot 获取最新画面。" +
    "此操作需要 Lookin 与 iOS App 保持连接，完成后缓存中的截图将反映最新 UI 状态。",
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

export async function handleRefreshScreenshot(args: { oid: number }): Promise<string> {
  const result = await lookinClient.refreshScreenshot(args.oid);
  return JSON.stringify(result);
}
