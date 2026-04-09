import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { deviceManager } from "../device-manager.js";
import { lookinClient } from "../client.js";

export const connectDeviceTool: Tool = {
  name: "lookin_connect_device",
  description:
    "Switch the lookin-mcp connection target. " +
    "Pass a device UDID (from lookin_list_devices) to connect to a USB physical device — " +
    "this automatically starts iproxy port forwarding. " +
    "Pass 'simulator' to switch back to the iOS simulator. " +
    "After switching, the connection is verified automatically.",
  inputSchema: {
    type: "object" as const,
    properties: {
      target: {
        type: "string",
        description:
          "Device UDID to connect to a physical device, or 'simulator' to switch back to the simulator.",
      },
    },
    required: ["target"],
  },
};

export async function handleConnectDevice(args: {
  target: string;
}): Promise<string> {
  const { target } = args;

  try {
    if (target === "simulator") {
      await deviceManager.connectSimulator();
    } else {
      await deviceManager.connectDevice(target);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ success: false, error: message });
  }

  // Verify the connection by calling /status
  try {
    const status = await lookinClient.getStatus();
    return JSON.stringify({
      success: true,
      target: deviceManager.getActiveTarget(),
      serverStatus: status,
      message:
        target === "simulator"
          ? "Switched to simulator successfully."
          : `Connected to device ${target} via USB (iproxy port forwarding active).`,
    });
  } catch (err) {
    // iproxy is running but the app is not in the foreground yet
    const errMsg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({
      success: true,
      target: deviceManager.getActiveTarget(),
      serverStatus: null,
      warning:
        `Port forwarding is active but LookinServer is not responding: ${errMsg}. ` +
        "Make sure your app with LookinServer is running in the foreground on the device.",
    });
  }
}
