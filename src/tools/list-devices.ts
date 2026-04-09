import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { deviceManager } from "../device-manager.js";

export const listDevicesTool: Tool = {
  name: "lookin_list_devices",
  description:
    "List all iOS physical devices currently connected via USB, and show the active connection target (simulator or a specific device). " +
    "Call this before switching to real device debugging to get the device UDID. " +
    "Uses macOS built-in usbmuxd — no additional tools required.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export async function handleListDevices(): Promise<string> {
  let devices;
  try {
    devices = await deviceManager.listDevices();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({
      error: message,
      activeTarget: deviceManager.getActiveTarget(),
      devices: [],
    });
  }

  const activeTarget = deviceManager.getActiveTarget();

  return JSON.stringify({
    activeTarget,
    devices,
    hint:
      devices.length === 0
        ? "No physical devices found. Connect an iOS device via USB and make sure it is trusted on this Mac."
        : `Found ${devices.length} device(s). Use lookin_connect_device with a udid to connect.`,
  });
}
