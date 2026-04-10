/**
 * DeviceManager
 *
 * 管理 lookin-mcp 的连接目标（模拟器 or USB 真机）。
 *
 * 真机模式：在 127.0.0.1:47191 启动一个本地 TCP 代理服务，
 * 每个入站连接通过 usbmuxd Unix socket 建立到设备 :47190 的隧道并双向管道转发。
 * client.ts 的 fetch 逻辑无需任何改动。
 *
 * 依赖：macOS 内置 usbmuxd（/var/run/usbmuxd），零外部工具依赖。
 */

import * as net from "net";
import { execSync } from "child_process";
import { listUsbDevices, connectToDevice, watchDevices } from "./usbmuxd.js";

const LOOKINSERVER_PORT = 47190;
const DEVICE_PROXY_PORT = 47191;

export type ConnectionTarget =
  | { type: "simulator" }
  | { type: "device"; udid: string };

export interface DeviceInfo {
  udid: string;
  name: string;
  type: "physical" | "simulator";
}

class DeviceManager {
  private _activeTarget: ConnectionTarget = { type: "simulator" };
  private _proxyServer: net.Server | null = null;
  private _activeDeviceId: number | null = null;
  private _needsDeviceSelection = false;
  private _stopWatch: (() => void) | null = null;
  /** deviceId → udid map, kept in sync by watchDevices */
  private _deviceIdMap = new Map<number, string>();

  getBaseUrl(): string {
    return this._activeTarget.type === "device"
      ? `http://127.0.0.1:${DEVICE_PROXY_PORT}`
      : `http://127.0.0.1:${LOOKINSERVER_PORT}`;
  }

  getActiveTarget(): ConnectionTarget {
    return this._activeTarget;
  }

  needsDeviceSelection(): boolean {
    return this._needsDeviceSelection;
  }

  /** Called at startup: auto-connect if exactly 1 device, otherwise flag for manual selection. */
  async autoConnect(): Promise<void> {
    const devices = await this.listDevices();
    if (devices.length === 1) {
      const device = devices[0];
      if (device.type === "physical") {
        await this.connectDevice(device.udid);
      }
      this._needsDeviceSelection = false;
    } else if (devices.length > 1) {
      this._needsDeviceSelection = true;
    }

    // Start watching for device connect/disconnect events
    if (!this._stopWatch) {
      watchDevices((event) => {
        if (event.type === "attached" && event.udid) {
          this._deviceIdMap.set(event.deviceId, event.udid);
        } else if (event.type === "detached") {
          const detachedUdid = this._deviceIdMap.get(event.deviceId);
          this._deviceIdMap.delete(event.deviceId);

          // If the active physical device was disconnected, re-run auto-connect
          if (
            this._activeTarget.type === "device" &&
            detachedUdid === this._activeTarget.udid
          ) {
            process.stderr.write(`[lookin-mcp] Device ${detachedUdid} disconnected, re-connecting...\n`);
            this._stopProxy().then(() => {
              this._activeTarget = { type: "simulator" };
              this.autoConnect().catch(() => { /* non-fatal */ });
            });
          }
        }
      }).then((stop) => {
        this._stopWatch = stop;
      }).catch(() => { /* usbmuxd watch unavailable, skip */ });
    }
  }

  /** List iOS devices connected via USB and running simulators. */
  async listDevices(): Promise<DeviceInfo[]> {
    const [physicalDevices, simulators] = await Promise.all([
      listUsbDevices().then((devices) =>
        devices.map((d) => ({
          udid: d.udid,
          name: d.udid,
          type: "physical" as const,
        }))
      ),
      this._listBootedSimulators(),
    ]);
    return [...physicalDevices, ...simulators];
  }

  private _listBootedSimulators(): DeviceInfo[] {
    try {
      const output = execSync("xcrun simctl list devices booted --json", { encoding: "utf-8" });
      const data = JSON.parse(output) as {
        devices: Record<string, Array<{ udid: string; name: string; state: string }>>;
      };
      const result: DeviceInfo[] = [];
      for (const devices of Object.values(data.devices)) {
        for (const dev of devices) {
          if (dev.state === "Booted") {
            result.push({ udid: dev.udid, name: dev.name, type: "simulator" });
          }
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  async connectSimulator(): Promise<void> {
    await this._stopProxy();
    this._activeDeviceId = null;
    this._activeTarget = { type: "simulator" };
    this._needsDeviceSelection = false;
  }

  async connectDevice(udid: string): Promise<void> {
    // Check if the UDID belongs to a booted simulator
    const simulators = this._listBootedSimulators();
    if (simulators.some((s) => s.udid === udid)) {
      await this.connectSimulator();
      return;
    }

    const devices = await listUsbDevices();
    const dev = devices.find((d) => d.udid === udid);
    if (!dev) {
      throw new Error(
        `Device ${udid} not found. Make sure it is connected via USB and trusted on this Mac.`
      );
    }

    await this._stopProxy();
    this._activeDeviceId = dev.deviceId;
    await this._startProxy(dev.deviceId);
    this._activeTarget = { type: "device", udid };
    this._needsDeviceSelection = false;
  }

  /**
   * Start a local TCP proxy on 127.0.0.1:47191.
   * Each incoming connection is tunneled to device:47190 via usbmuxd.
   */
  private _startProxy(deviceId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((clientSock) => {
        connectToDevice(deviceId, LOOKINSERVER_PORT)
          .then((tunnel) => {
            clientSock.pipe(tunnel);
            tunnel.pipe(clientSock);
            clientSock.on("error", () => tunnel.destroy());
            clientSock.on("close", () => tunnel.destroy());
            tunnel.on("error", () => clientSock.destroy());
            tunnel.on("close", () => clientSock.destroy());
          })
          .catch(() => {
            clientSock.destroy();
          });
      });

      this._proxyServer = server;

      server.listen(DEVICE_PROXY_PORT, "127.0.0.1", () => resolve());

      server.on("error", (err: NodeJS.ErrnoException) => {
        this._proxyServer = null;
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${DEVICE_PROXY_PORT} is already in use. Stop any existing lookin-mcp instance first.`
            )
          );
        } else {
          reject(err);
        }
      });
    });
  }

  private _stopProxy(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._proxyServer) {
        resolve();
        return;
      }
      this._proxyServer.close(() => resolve());
      this._proxyServer = null;
    });
  }

  async shutdown(): Promise<void> {
    this._stopWatch?.();
    this._stopWatch = null;
    await this._stopProxy();
  }
}

export const deviceManager = new DeviceManager();
