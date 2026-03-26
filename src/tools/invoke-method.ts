import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../lookin-client.js";

export const invokeMethodTool: Tool = {
  name: "lookin_invoke_method",
  description:
    "在 iOS App 中对指定对象调用无参数方法（property getter 或无参 selector）。\n\n" +
    "常用示例：\n" +
    "- method: 'description' → 获取对象的 debugDescription\n" +
    "- method: 'frame' → 获取当前 frame\n" +
    "- method: 'backgroundColor' → 获取背景色\n" +
    "- method: 'subviews' → 获取子视图列表\n" +
    "- method: 'superview' → 获取父视图\n" +
    "- method: 'recursiveDescription' → 获取视图层级文本描述\n\n" +
    "需要 Lookin.app 已连接 iOS 设备/模拟器。",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description: "目标对象的 object ID（从 lookin_get_hierarchy 的 oid 字段获取）",
      },
      method: {
        type: "string",
        description:
          "方法名或 property 名称（无参数），如 'frame'、'description'、'backgroundColor'",
      },
    },
    required: ["oid", "method"],
  },
};

export async function handleInvokeMethod(args: {
  oid: number;
  method: string;
}): Promise<string> {
  const result = await lookinClient.invokeMethod(args.oid, args.method);
  return result.result ?? "(nil)";
}
