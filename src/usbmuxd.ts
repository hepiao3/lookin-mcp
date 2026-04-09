/**
 * usbmuxd 最小客户端
 *
 * macOS 内置 usbmuxd 守护进程监听 /var/run/usbmuxd Unix socket。
 * 通过它可以：
 *   1. listDevices()      — 列出当前 USB 连接的 iOS 设备
 *   2. connectToDevice()  — 建立到设备指定端口的透明 TCP 隧道
 *
 * 协议格式（Binary plist 模式）：
 *   [4B totalLength LE][4B version=1][4B msgType=8][4B tag LE][binary plist body]
 */

import * as net from "net";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bplistCreator = require("bplist-creator") as (obj: unknown) => Buffer;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bplistParser = require("bplist-parser") as {
  parseBuffer(buf: Buffer): Array<Record<string, unknown>>;
};

const USBMUXD_SOCKET = "/var/run/usbmuxd";
const LOOKINSERVER_PORT = 47190;

// ──────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────

function buildMsg(tag: number, payload: object): Buffer {
  const body: Buffer = bplistCreator(payload);
  const header = Buffer.alloc(16);
  header.writeUInt32LE(16 + body.length, 0); // total length
  header.writeUInt32LE(1, 4);                // version = 1 (binary plist)
  header.writeUInt32LE(8, 8);                // msgType = 8 (plist message)
  header.writeUInt32LE(tag, 12);             // tag
  return Buffer.concat([header, body]);
}

function connectSocket(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(USBMUXD_SOCKET);
    sock.once("connect", () => resolve(sock));
    sock.once("error", (err) => reject(new Error(`usbmuxd not available: ${err.message}`)));
  });
}

/** Send a plist message and wait for the response plist. */
function sendRecv(
  sock: net.Socket,
  payload: object
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let received = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      if (received.length < 16) return;
      const totalLen = received.readUInt32LE(0);
      if (received.length < totalLen) return;

      sock.off("data", onData);
      sock.off("error", onErr);

      const body = received.slice(16, totalLen);
      try {
        const result = bplistParser.parseBuffer(body);
        resolve(result[0]);
      } catch (e) {
        reject(e);
      }
    };

    const onErr = (err: Error) => {
      sock.off("data", onData);
      reject(err);
    };

    sock.on("data", onData);
    sock.once("error", onErr);
    sock.write(buildMsg(1, payload));
  });
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

export interface UsbDevice {
  /** usbmuxd internal device ID (not stable across reconnects) */
  deviceId: number;
  /** Device UDID (stable identifier) */
  udid: string;
}

/** List iOS devices currently connected via USB. */
export async function listUsbDevices(): Promise<UsbDevice[]> {
  const sock = await connectSocket();
  try {
    const resp = await sendRecv(sock, { MessageType: "ListDevices" });
    const list = (resp.DeviceList as Array<{
      DeviceID: number;
      Properties: { SerialNumber: string; ConnectionType: string };
    }>) ?? [];
    // Only USB-connected devices (skip Wi-Fi)
    return list
      .filter((d) => d.Properties?.ConnectionType === "USB")
      .map((d) => ({ deviceId: d.DeviceID, udid: d.Properties.SerialNumber }));
  } finally {
    sock.destroy();
  }
}

/**
 * Establish a TCP tunnel to `port` on the device identified by `deviceId`.
 * After this call, the returned socket IS the tunnel — write HTTP directly to it.
 */
export async function connectToDevice(
  deviceId: number,
  port: number = LOOKINSERVER_PORT
): Promise<net.Socket> {
  const sock = await connectSocket();

  // usbmuxd expects port in network byte order (big-endian)
  const portBE = ((port & 0xff) << 8) | ((port >> 8) & 0xff);

  const resp = await sendRecv(sock, {
    MessageType: "Connect",
    DeviceID: deviceId,
    PortNumber: portBE,
  });

  const code = resp.Number as number;
  if (code !== 0) {
    sock.destroy();
    const ERRORS: Record<number, string> = {
      2: "device is not connected",
      3: "port is not open on the device (is LookinServer running?)",
      5: "connection refused",
    };
    throw new Error(
      `usbmuxd Connect failed (code ${code}): ${ERRORS[code] ?? "unknown error"}`
    );
  }

  // Socket is now a transparent tunnel to device:port
  return sock;
}
