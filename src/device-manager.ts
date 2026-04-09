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
import { listUsbDevices, connectToDevice } from "./usbmuxd.js";

const LOOKINSERVER_PORT = 47190;
const DEVICE_PROXY_PORT = 47191;

export type ConnectionTarget =
  | { type: "simulator" }
  | { type: "device"; udid: string };

export interface DeviceInfo {
  udid: string;
  name: string;
  type: "physical";
}

class DeviceManager {
  private _activeTarget: ConnectionTarget = { type: "simulator" };
  private _proxyServer: net.Server | null = null;
  private _activeDeviceId: number | null = null;

  getBaseUrl(): string {
    return this._activeTarget.type === "device"
      ? `http://127.0.0.1:${DEVICE_PROXY_PORT}`
      : `http://127.0.0.1:${LOOKINSERVER_PORT}`;
  }

  getActiveTarget(): ConnectionTarget {
    return this._activeTarget;
  }

  /** List iOS devices connected via USB (uses usbmuxd directly, no external tools). */
  async listDevices(): Promise<DeviceInfo[]> {
    const devices = await listUsbDevices();
    return devices.map((d) => ({
      udid: d.udid,
      name: d.udid, // usbmuxd doesn't expose device name; UDID is sufficient for connection
      type: "physical" as const,
    }));
  }

  async connectSimulator(): Promise<void> {
    await this._stopProxy();
    this._activeDeviceId = null;
    this._activeTarget = { type: "simulator" };
  }

  async connectDevice(udid: string): Promise<void> {
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
    await this._stopProxy();
  }
}

export const deviceManager = new DeviceManager();
