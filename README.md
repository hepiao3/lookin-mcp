# lookin-mcp-server

[Lookin](https://lookin.work) 的 MCP Server，让 Claude Code 能够直接查看和修改 iOS App 的 UI 视图层级与属性。

---

## 前提条件

- 已安装 [Lookin](https://lookin.work) macOS 客户端
- 已安装 [Claude Code](https://claude.ai/code)
- Node.js 18+

---

## 工作原理

```
Claude Code
    ↓ stdio (MCP 协议)
lookin-mcp-server (Node.js)
    ↓ HTTP localhost:47200
Lookin.app 内嵌 HTTP Server
    ↓ USB / Simulator
iOS App (LookinServer)
```

Lookin.app 启动后会在本地监听 47200 端口。MCP Server 作为中间层，将 Claude Code 的工具调用转换为对该端口的 HTTP 请求。

---

## 安装

**Lookin.app 会在首次启动时自动完成以下配置：**

1. 将 MCP Server 复制到 `~/.lookin/mcp-server/mcp-server.js`
2. 执行 `claude mcp add --scope user lookin` 自动注册到 Claude Code

无需手动配置。打开 Lookin.app 并连接 iOS 设备/模拟器后，即可在 Claude Code 中使用以下工具。

---

## 工具列表

### `lookin_get_hierarchy`

获取当前 iOS App 的 UI 视图层级树。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `includeSystemViews` | boolean | 否 | 是否包含系统视图（UIKit 私有类）。默认 `false` |
| `maxDepth` | number | 否 | 最大层级深度。不传则返回全部 |

**返回示例：**
```json
{"appName":"Demo","totalViews":12,"hierarchy":[{"oid":4393842688,"title":"UIWindow","frame":[0,0,390,844],"children":[{"oid":4393842944,"title":"MyViewController","frame":[0,0,390,844],"children":[]}]}]}
```

每个节点字段说明：
- `oid` — 视图唯一标识符，传给其他工具使用
- `title` — 类名
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
- `identifier` — 属性标识符（修改时需传入）
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
| 27 | UIColor（RGBA 数组，0~1） |
| 25 | 枚举 int |
| 26 | 枚举 long |
| 24 | NSString |

---

### `lookin_modify_attribute`

修改指定视图的 UI 属性，实时反映到 iOS App。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oid` | number | 是 | 视图 ID |
| `setterSelector` | string | 是 | setter 方法名，如 `setBackgroundColor:` |
| `attrType` | number | 是 | 值类型枚举（见上表） |
| `value` | any | 是 | 新值，格式取决于 attrType |
| `identifier` | string | 否 | 属性标识符，传入后服务端自动判断修改 UIView 还是 CALayer |

**value 格式示例：**

```
BOOL:        true / false
float/int:   0.5
CGRect:      {"x":0,"y":0,"width":100,"height":50}
CGPoint:     {"x":10,"y":20}
CGSize:      {"width":100,"height":50}
UIColor:     {"r":1.0,"g":0.0,"b":0.0,"a":1.0}
NSString:    "Hello"
枚举:        3
```

---

### `lookin_get_screenshot`

获取指定视图的截图。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oid` | number | 是 | 视图 ID |

**返回：** MCP image content，PNG 格式，Claude 可直接查看图片内容。

---

### `lookin_invoke_method`

对 iOS App 中指定对象调用无参数方法。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oid` | number | 是 | 视图 ID |
| `method` | string | 是 | 方法名或属性名 |

**常用 method：**

| method | 说明 |
|--------|------|
| `description` | 获取对象描述 |
| `recursiveDescription` | 获取视图层级文本 |
| `backgroundColor` | 获取背景色 |
| `subviews` | 获取子视图列表 |
| `superview` | 获取父视图 |
| `frame` | 获取当前 frame |

---

## 典型使用流程

```
1. lookin_get_hierarchy          → 获取视图树，找到目标视图的 oid
2. lookin_get_attributes(oid)    → 查看该视图的所有属性
3. lookin_modify_attribute(...)  → 修改属性，实时预览效果
4. lookin_get_screenshot(oid)    → 截图确认修改结果
```

---

## 调试

直接 curl Lookin 的 HTTP 接口验证连通性：

```bash
# 查看连接状态
curl http://localhost:47200/status

# 获取视图层级
curl http://localhost:47200/hierarchy
```

**常见问题：**

| 现象 | 原因 | 解决 |
|------|------|------|
| 连接被拒绝 | Lookin.app 未运行 | 打开 Lookin.app |
| `connected: false` | 未连接 iOS 设备 | 在 Lookin 中选择 App |
| `Hierarchy not loaded yet` | 层级数据未加载 | 等待 Lookin 刷新完成 |
| 工具返回节点为空 | 系统视图被过滤 | 传 `includeSystemViews: true` |

---

## License

MIT
