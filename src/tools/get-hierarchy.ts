import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lookinClient, HierarchyItem } from "../lookin-client.js";

export const getHierarchyTool: Tool = {
  name: "lookin_get_hierarchy",
  description:
    "获取当前 iOS App 的 UI 视图层级树。每个节点包含 oid、title（类名）、frame([x,y,w,h])，" +
    "hidden/alpha 只在非默认值时出现。oid 可传给其他 lookin_* 工具查询属性或截图。" +
    "默认过滤系统视图（UIKit 私有类），可显著减少返回数据量。",
  inputSchema: {
    type: "object" as const,
    properties: {
      includeSystemViews: {
        type: "boolean",
        description:
          "是否包含系统视图（UIKit 私有视图）。默认 false（过滤掉以减少 token 用量）。",
      },
      maxDepth: {
        type: "number",
        description: "最大层级深度限制。不传则返回全部层级。",
      },
    },
  },
};

function filterItems(
  items: HierarchyItem[],
  includeSystem: boolean,
  maxDepth: number,
  currentDepth = 0
): HierarchyItem[] {
  if (maxDepth > 0 && currentDepth >= maxDepth) return [];
  return items
    .filter((item) => includeSystem || !item.sys)
    .map((item) => {
      // 过滤掉 sys 字段本身，减少输出体积
      const { sys, ...rest } = item;
      return {
        ...rest,
        children: filterItems(item.children, includeSystem, maxDepth, currentDepth + 1),
      };
    });
}

export async function handleGetHierarchy(args: {
  includeSystemViews?: boolean;
  maxDepth?: number;
}): Promise<string> {
  const result = await lookinClient.getHierarchy();
  // 默认 false：过滤系统视图，大幅减少节点数量
  const includeSystem = args.includeSystemViews === true;
  const maxDepth = args.maxDepth ?? 0;

  const items = filterItems(result.items, includeSystem, maxDepth);

  function countItems(list: HierarchyItem[]): number {
    return list.reduce((sum, item) => sum + 1 + countItems(item.children), 0);
  }

  // 紧凑 JSON（无缩进），显著减少 token 用量
  return JSON.stringify({
    appName: result.appName,
    totalViews: countItems(items),
    hierarchy: items,
  });
}
