# lookin-mcp-ios

MCP Server for iOS UI inspection — lets any AI agent (Claude Code, Cursor, Codex, etc.) inspect live iOS app UI hierarchy, attributes, and screenshots via LookinServer, no Lookin.app required.

---

## Prerequisites

- iOS App integrated with [LookinServerMCP](https://github.com/hepiao3/LookinServer), running on simulator or device
- Node.js 18+

### iOS Integration

Add the following to your `Podfile`:

```ruby
pod 'LookinServerMCP', :configurations => ['Debug']
```

> Only included in Debug builds — safe to leave in your Podfile permanently.

---

## How It Works

### Device Support

The MCP Server supports both iOS simulators and physical devices:

**iOS Simulator:**
```
AI Agent (Claude Code / Cursor / Codex / ...)
    ↓ stdio (MCP protocol)
lookin-mcp-ios (Node.js)
    ↓ HTTP local port
LookinServer (embedded in iOS App)
```

**Physical Device:**
```
AI Agent (Claude Code / Cursor / Codex / ...)
    ↓ stdio (MCP protocol)
lookin-mcp-ios (Node.js)
    ↓ native usbmuxd socket (/var/run/usbmuxd)
    ↓ TCP proxy on :47191
LookinServer (embedded in iOS App)
```

### Device Selection

- **Single device**: Automatically connects when the app starts
- **Multiple devices**: Prompts user to select device via `lookin_connect_device` tool
- **Device events**: Automatically reconnects when a physical device is unplugged (falls back to simulator)

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

### `lookin_list_devices`

Lists all connectable iOS targets: USB physical devices and booted simulators.

**Parameters:** None

**Response:** JSON object containing:
- `activeTarget` — currently connected target (type: `"simulator"` or `"physical"`)
- `devices` — array of available devices, each with:
  - `udid` — unique device identifier
  - `name` — device name (e.g. "iPhone 15 Pro")
  - `type` — device type (`"simulator"` or `"physical"`)
- `hint` — usage instructions

**Example response:**
```json
{
  "activeTarget": { "type": "simulator" },
  "devices": [
    { "udid": "ABC123...", "name": "iPhone 16 Pro", "type": "simulator" },
    { "udid": "XYZ789...", "name": "John's iPhone", "type": "physical" }
  ],
  "hint": "Found 2 device(s). Use lookin_connect_device with a udid to connect."
}
```

---

### `lookin_connect_device`

Switch the connection target to a physical device or simulator.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | Device UDID (from `lookin_list_devices`) or `"simulator"` to use the default simulator |

**Response:** Confirmation message and connection status

---

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
1. lookin_list_devices           → list available iOS targets (simulators and physical devices)
2. lookin_connect_device(target) → select the target device (if multiple devices available)
3. lookin_get_hierarchy          → get the view tree and find the target view's oid
4. lookin_get_attributes(oid)    → inspect all attributes of that view
5. lookin_get_screenshot(oid)    → capture a screenshot to see the current UI state
```

> If only one device is available, steps 1-2 are handled automatically at startup.
