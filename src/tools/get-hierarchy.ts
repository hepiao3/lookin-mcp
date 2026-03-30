import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient, HierarchyItem } from "../client.js";

export const getHierarchyTool: Tool = {
  name: "lookin_get_hierarchy",
  description:
    "获取当前 iOS App 的 UI 视图层级树。每个节点包含 oid、className（类名）、frame([x,y,w,h])，" +
    "hidden/alpha 只在非默认值时出现。oid 可传给其他 lookin_* 工具查询属性或截图。\n" +
    "注意：直连 LookinServer 时所有视图均返回（不区分系统视图），includeSystemViews 参数无过滤效果。",
  inputSchema: {
    type: "object" as const,
    properties: {
      includeSystemViews: {
        type: "boolean",
        description:
          "保留参数，直连 LookinServer 时无过滤效果（LookinServer 不标记系统视图）。",
      },
      maxDepth: {
        type: "number",
        description: "最大层级深度限制。不传则返回全部层级。",
      },
    },
  },
};

function limitDepth(
  items: HierarchyItem[],
  maxDepth: number,
  currentDepth = 0
): HierarchyItem[] {
  if (maxDepth > 0 && currentDepth >= maxDepth) return [];
  return items.map((item) => ({
    ...item,
    children: limitDepth(item.children, maxDepth, currentDepth + 1),
  }));
}

function countItems(list: HierarchyItem[]): number {
  return list.reduce((sum, item) => sum + 1 + countItems(item.children), 0);
}

export async function handleGetHierarchy(args: {
  includeSystemViews?: boolean;
  maxDepth?: number;
}): Promise<string> {
  const result = await lookinClient.getHierarchy();
  const maxDepth = args.maxDepth ?? 0;

  const items = maxDepth > 0 ? limitDepth(result.items, maxDepth) : result.items;

  return JSON.stringify({
    appName: result.appName,
    totalViews: countItems(items),
    hierarchy: items,
  });
}
