# lookin-mcp-ios

MCP Server for iOS UI inspection — lets any AI agent (Claude Code, Cursor, Codex, etc.) inspect live iOS app UI hierarchy, attributes, and screenshots via LookinServer, no Lookin.app required.

---

## Prerequisites

- iOS App integrated with [LookinServer](https://github.com/QMUI/LookinServer), running on simulator or device
- Node.js 18+

---

## How It Works

```
AI Agent (Claude Code / Cursor / Codex / ...)
    ↓ stdio (MCP protocol)
lookin-mcp-ios (Node.js)
    ↓ HTTP local port
LookinServer (embedded in iOS App)
```

The MCP Server communicates directly with LookinServer embedded in your iOS app over local HTTP, no Lookin.app relay needed.

---

## Installation

### Claude Code

```bash
claude mcp add --scope user lookin -- npx -y lookin-mcp-ios
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` in your project root:

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

Add to `~/.codex/config.yaml`:

```yaml
mcp_servers:
  - name: lookin
    command: npx
    args:
      - -y
      - lookin-mcp-ios
```

---

## Tools

### `lookin_get_hierarchy`

Returns the full UI view hierarchy tree of the running iOS app.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeSystemViews` | boolean | No | Reserved parameter, no filtering effect when connected directly to LookinServer |
| `maxDepth` | number | No | Maximum hierarchy depth. Returns all levels if omitted |

**Example response:**
```json
{"appName":"Demo","totalViews":12,"hierarchy":[{"oid":4393842688,"className":"UIWindow","frame":[0,0,390,844],"children":[{"oid":4393842944,"className":"MyViewController","frame":[0,0,390,844],"children":[]}]}]}
```

Node fields:
- `oid` — unique view identifier, used as input for other tools
- `className` — class name
- `frame` — position and size `[x, y, width, height]`
- `hidden` — only present when `true`
- `alpha` — only present when not 1.0

---

### `lookin_get_attributes`

Returns all UI attributes of a specified view.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oid` | number | Yes | View ID (from `lookin_get_hierarchy`) |

**Response:** Attributes grouped by group → section → attribute, each containing:
- `identifier` — attribute identifier
- `setterSelector` — setter method name, e.g. `setBackgroundColor:`
- `attrType` — value type enum
- `value` — current value

**attrType values:**

| Value | Type |
|-------|------|
| 14 | BOOL |
| 12 | float |
| 13 | double |
| 5 | NSInteger |
| 20 | CGRect |
| 17 | CGPoint |
| 19 | CGSize |
| 22 | UIEdgeInsets |
| 23 | UIColor (RGBA array, 0~1) |
| 25 | enum int |
| 26 | enum long |
| 24 | NSString |

---

### `lookin_get_screenshot`

Captures a screenshot of a specified view from the live iOS app rendering.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oid` | number | No | View ID. If omitted, automatically uses the root window for a full-screen screenshot |

**Response:** MCP image content in PNG format, viewable directly by the AI agent.

---

## Typical Workflow

```
1. lookin_get_hierarchy          → get the view tree and find the target view's oid
2. lookin_get_attributes(oid)    → inspect all attributes of that view
3. lookin_get_screenshot(oid)    → capture a screenshot to see the current UI state
```
