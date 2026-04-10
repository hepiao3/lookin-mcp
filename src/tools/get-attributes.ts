import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient } from "../client.js";

export const getAttributesTool: Tool = {
  name: "lookin_get_attributes",
  description:
    "Query all UI attributes of a specified view node, including color, font, frame, alpha, hidden, constraints, etc.\n" +
    "First use lookin_get_hierarchy to get the oid of the target view.\n" +
    "Returned attributes are classified by group (AttributeGroup) and section (Section), each attribute contains:\n" +
    "- identifier: attribute identifier\n" +
    "- setterSelector: setter method name to modify this attribute, pass to lookin_modify_attribute\n" +
    "- attrType: value type enum (14=BOOL, 12=float, 13=double, 5=NSInteger, " +
    "20=CGRect, 17=CGPoint, 19=CGSize, 22=UIEdgeInsets, " +
    "23=UIColor, 25=enum int, 26=enum long, 24=NSString)\n" +
    "- value: current value",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "Object ID of the target view (get from lookin_get_hierarchy's oid field)",
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
