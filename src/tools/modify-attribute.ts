import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../lookin-client.js";

export const modifyAttributeTool: Tool = {
  name: "lookin_modify_attribute",
  description:
    "修改指定视图的 UI 属性，修改会实时反映到 iOS App 中。\n\n" +
    "使用步骤：\n" +
    "1. 通过 lookin_get_hierarchy 获取目标视图的 oid\n" +
    "2. 通过 lookin_get_attributes 查看可修改的属性（获取 identifier、setterSelector、attrType）\n" +
    "3. 调用本工具修改\n\n" +
    "value 格式按 attrType 不同而变化：\n" +
    "- BOOL(14): true/false\n" +
    "- float(12)/double(13)/NSInteger(5): 数字，如 0.5\n" +
    "- CGRect(20): {\"x\":0,\"y\":0,\"width\":100,\"height\":50}\n" +
    "- CGPoint(17): {\"x\":10,\"y\":20}\n" +
    "- CGSize(19): {\"width\":100,\"height\":50}\n" +
    "- UIColor(27): {\"r\":1.0,\"g\":0.0,\"b\":0.0,\"a\":1.0}（0~1 范围）\n" +
    "- enum int(25)/enum long(26): 整数枚举值\n" +
    "- NSString(24): 字符串",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description: "目标视图的 object ID（从 lookin_get_hierarchy 获取）",
      },
      identifier: {
        type: "string",
        description:
          "属性标识符（从 lookin_get_attributes 返回的 identifier 字段获取）。" +
          "服务端用此字段判断属性属于 UIView 还是 CALayer，自动选择正确的目标对象。",
      },
      setterSelector: {
        type: "string",
        description: "setter 方法选择子，从 lookin_get_attributes 返回的属性中获取，如 'setBackgroundColor:'。",
      },
      attrType: {
        type: "number",
        description: "属性类型枚举值（从 lookin_get_attributes 返回的 attrType 字段获取）",
      },
      value: {
        description: "新属性值，格式取决于 attrType（见工具描述）",
      },
    },
    required: ["oid", "setterSelector", "attrType", "value"],
  },
};

export async function handleModifyAttribute(args: {
  oid: number;
  identifier?: string;
  setterSelector: string;
  attrType: number;
  value: unknown;
}): Promise<string> {
  const result = await lookinClient.modifyAttribute(
    args.oid,
    args.identifier,
    args.setterSelector,
    args.attrType,
    args.value
  );
  return JSON.stringify(result);
}
