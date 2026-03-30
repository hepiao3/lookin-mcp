/**
 * LookinServer HTTP 客户端
 * 封装与 LookinServer 内置 HTTP Server（127.0.0.1:47190）的通讯
 * 直连 iOS App，无需 Lookin.app 中转
 */

const BASE_URL = "http://127.0.0.1:47190";
const REQUEST_TIMEOUT_MS = 15000;

export interface LookinResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HierarchyItem {
  oid: number;
  className: string;
  hidden?: boolean;
  alpha?: number;
  frame: [number, number, number, number]; // [x, y, w, h]
  customTitle?: string;
  children: HierarchyItem[];
}

export interface HierarchyResult {
  appName: string;
  items: HierarchyItem[];
}

export interface AttributeGroup {
  identifier: string;
  title: string;
  sections: AttributeSection[];
}

export interface AttributeSection {
  identifier: string;
  attributes: Attribute[];
}

export interface Attribute {
  identifier: string;
  attrType: number;
  typeDescription: string;
  value: unknown;
}

export interface AttributesResult {
  oid: number;
  groups: AttributeGroup[];
}

export interface ScreenshotResult {
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface StatusResult {
  active: boolean;
  appName?: string;
  bundleId?: string;
  osDescription?: string;
  deviceDescription?: string;
  screenWidth?: number;
  screenHeight?: number;
  screenScale?: number;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = (await response.json()) as LookinResponse<T>;

    if (!json.success) {
      throw new Error(json.error ?? "Unknown error from LookinServer");
    }

    return json.data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Request to LookinServer timed out. Make sure the iOS App with LookinServer is running."
      );
    }
    if (
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed"))
    ) {
      throw new Error(
        "Cannot connect to LookinServer (127.0.0.1:47190). " +
        "Make sure the iOS App with LookinServer is running in the foreground."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const lookinClient = {
  getStatus(): Promise<StatusResult> {
    return request<StatusResult>("GET", "/status");
  },

  getHierarchy(): Promise<HierarchyResult> {
    return request<HierarchyResult>("GET", "/hierarchy");
  },

  getAttributes(oid: number): Promise<AttributesResult> {
    return request<AttributesResult>("GET", `/view/${oid}/attributes`);
  },

  modifyAttribute(
    oid: number,
    setterSelector: string,
    attrType: number,
    value: unknown
  ): Promise<{ modified: boolean }> {
    return request<{ modified: boolean }>("POST", `/view/${oid}/attributes`, {
      setterSelector,
      attrType,
      value,
    });
  },

  getScreenshot(oid: number): Promise<ScreenshotResult> {
    return request<ScreenshotResult>("GET", `/view/${oid}/screenshot`);
  },

  invokeMethod(oid: number, method: string): Promise<{ result: string }> {
    return request<{ result: string }>("POST", "/console/invoke", {
      oid,
      method,
    });
  },
};
