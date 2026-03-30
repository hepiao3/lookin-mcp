import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../client.js";

export const getAttributesTool: Tool = {
  name: "lookin_get_attributes",
  description:
    "查询指定视图节点的所有 UI 属性，包括颜色、字体、frame、alpha、hidden、约束等。\n" +
    "需要先通过 lookin_get_hierarchy 获取目标视图的 oid。\n" +
    "返回的属性按组（AttributeGroup）和节（Section）分类，每个属性包含：\n" +
    "- identifier：属性标识符\n" +
    "- setterSelector：修改该属性的 setter 方法名，传给 lookin_modify_attribute\n" +
    "- attrType：值类型枚举（14=BOOL, 12=float, 13=double, 5=NSInteger, " +
    "20=CGRect, 17=CGPoint, 19=CGSize, 22=UIEdgeInsets, " +
    "23=UIColor, 25=枚举int, 26=枚举long, 24=NSString）\n" +
    "- value：当前值",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "目标视图的 object ID（从 lookin_get_hierarchy 的 oid 字段获取）",
      },
    },
    required: ["oid"],
  },
};

export async function handleGetAttributes(args: {
  oid: number;
}): Promise<string> {
  const result = await lookinClient.getAttributes(args.oid);
  return JSON.stringify(result);
}
