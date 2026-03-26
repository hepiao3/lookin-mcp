/**
 * Lookin HTTP 客户端
 * 封装与 Lookin.app 内嵌 HTTP Server（localhost:47200）的通讯
 */

const BASE_URL = "http://localhost:47200";
const REQUEST_TIMEOUT_MS = 15000;

export interface LookinResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HierarchyItem {
  oid: number;
  title: string;
  hidden?: true;   // omitted when false
  alpha?: number;  // omitted when 1.0
  sys?: true;      // omitted when not a system class
  frame: [number, number, number, number]; // [x, y, w, h]
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
  connected: boolean;
  appName?: string;
  bundleId?: string;
  osDescription?: string;
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
      throw new Error(json.error ?? "Unknown error from Lookin");
    }

    return json.data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Request to Lookin timed out. Make sure Lookin.app is running."
      );
    }
    if (
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed"))
    ) {
      throw new Error(
        "Cannot connect to Lookin.app. Please make sure Lookin is running on your Mac."
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
    identifier: string | undefined,
    setterSelector: string,
    attrType: number,
    value: unknown
  ): Promise<{ modified: boolean }> {
    return request<{ modified: boolean }>("POST", `/view/${oid}/attributes`, {
      identifier,
      setterSelector,
      attrType,
      value,
    });
  },

  getScreenshot(oid?: number): Promise<ScreenshotResult> {
    const path = oid !== undefined ? `/view/${oid}/screenshot` : `/view/0/screenshot`;
    return request<ScreenshotResult>("GET", path);
  },

  invokeMethod(oid: number, method: string): Promise<{ result: string }> {
    return request<{ result: string }>("POST", "/console/invoke", {
      oid,
      method,
    });
  },
};
