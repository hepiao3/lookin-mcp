# lookin-mcp-ios

MCP Server，让 Claude Code 能够直接查看 iOS App 的 UI 视图层级与属性。无需 Lookin.app，通过本地连接与 iOS App 内嵌的 LookinServer 直接通信。

---

## 前提条件

- iOS App 已集成 [LookinServer](https://github.com/QMUI/LookinServer) 并运行在模拟器或真机上
- 已安装 [Claude Code](https://claude.ai/code)
- Node.js 18+

---

## 工作原理

```
Claude Code
    ↓ stdio (MCP 协议)
lookin-mcp-ios (Node.js)
    ↓ HTTP 本地端口
LookinServer（嵌入 iOS App）
```

MCP Server 通过本地 HTTP 与 iOS App 内嵌的 LookinServer 直接通信，无需经过 Lookin.app 中转。

---

## 安装

### Claude Code

```bash
claude mcp add --scope user lookin -- npx -y lookin-mcp-ios
```

### Cursor

在 `~/.cursor/mcp.json`（全局）或项目根目录 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "lookin": {
      "command": "npx",
      "args": ["-y", "lookin-mcp-ios"]
    }
  }
}
```

### Codex

在 `~/.codex/config.yaml` 中添加：

```yaml
mcp_servers:
  - name: lookin
    command: npx
    args:
      - -y
      - lookin-mcp-ios
```

---

## 工具列表

### `lookin_get_hierarchy`

获取当前 iOS App 的 UI 视图层级树。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `includeSystemViews` | boolean | 否 | 保留参数，直连 LookinServer 时无过滤效果 |
| `maxDepth` | number | 否 | 最大层级深度。不传则返回全部 |

**返回示例：**
```json
{"appName":"Demo","totalViews":12,"hierarchy":[{"oid":4393842688,"className":"UIWindow","frame":[0,0,390,844],"children":[{"oid":4393842944,"className":"MyViewController","frame":[0,0,390,844],"children":[]}]}]}
```

每个节点字段说明：
- `oid` — 视图唯一标识符，传给其他工具使用
- `className` — 类名
- `frame` — 位置尺寸 `[x, y, width, height]`
- `hidden` — 仅在 `true` 时出现
- `alpha` — 仅在非 1.0 时出现

---

### `lookin_get_attributes`

查询指定视图的所有 UI 属性。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oid` | number | 是 | 视图 ID（从 `lookin_get_hierarchy` 获取） |

**返回：** 属性按 group → section → attribute 分组，每个属性包含：
- `identifier` — 属性标识符
- `setterSelector` — setter 方法名，如 `setBackgroundColor:`
- `attrType` — 值类型枚举
- `value` — 当前值

**attrType 枚举值：**

| 值 | 类型 |
|----|------|
| 14 | BOOL |
| 12 | float |
| 13 | double |
| 5 | NSInteger |
| 20 | CGRect |
| 17 | CGPoint |
| 19 | CGSize |
| 22 | UIEdgeInsets |
| 23 | UIColor（RGBA 数组，0~1） |
| 25 | 枚举 int |
| 26 | 枚举 long |
| 24 | NSString |

---

### `lookin_get_screenshot`

获取指定视图的截图，截图来自 iOS App 实时渲染。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oid` | number | 否 | 视图 ID。不传则自动使用根视图（window）进行全屏截图 |

**返回：** MCP image content，PNG 格式，Claude 可直接查看图片内容。

---

## 典型使用流程

```
1. lookin_get_hierarchy          → 获取视图树，找到目标视图的 oid
2. lookin_get_attributes(oid)    → 查看该视图的所有属性
3. lookin_get_screenshot(oid)    → 截图查看当前 UI 状态
```

---

## License

MIT
