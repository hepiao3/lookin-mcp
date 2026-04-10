import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient, HierarchyItem } from "../client.js";

export const getHierarchyTool: Tool = {
  name: "lookin_get_hierarchy",
  description:
    "Get the UI view hierarchy tree of the current iOS app. Each node contains oid, className, frame([x,y,w,h]), " +
    "hidden/alpha only appear for non-default values. oid can be passed to other lookin_* tools to query attributes or screenshots.\n" +
    "Note: when directly connected to LookinServer, all views are returned (system views are not distinguished), includeSystemViews parameter has no filtering effect.",
  inputSchema: {
    type: "object" as const,
    properties: {
      includeSystemViews: {
        type: "boolean",
        description:
          "Reserved parameter. When directly connected to LookinServer, it has no filtering effect (LookinServer does not mark system views).",
      },
      maxDepth: {
        type: "number",
        description: "Maximum hierarchy depth limit. If not provided, returns all levels.",
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
