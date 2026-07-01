/**
 * Komari REST API client SDK.
 * Mirrors the original Vue version but uses `process.env.NEXT_PUBLIC_API_BASE`
 * for build-time configuration under Next.js.
 * @see https://www.komari.wiki/dev/api.html
 */

const HTTP_PROTOCOL_REGEX = /^http/;
const HTTPS_PROTOCOL_REGEX = /^https/;

// ==================== Types ====================

interface ApiResponse<T = unknown> {
  status: "success" | "error";
  message: string;
  data: T;
}

export interface MeInfo {
  logged_in: boolean;
  username: string;
  "2fa_enabled"?: boolean;
  sso_id?: string;
  sso_type?: string;
  uuid?: string;
}

export interface PublicSettings {
  allow_cors: boolean;
  custom_body: string;
  custom_head: string;
  description: string;
  disable_password_login: boolean;
  oauth_enable: boolean;
  oauth_provider: string | null;
  ping_record_preserve_time: number;
  private_site: boolean;
  record_enabled: boolean;
  record_preserve_time: number;
  sitename: string;
  theme: string;
  theme_settings?: Record<string, unknown> | null;
  dataUpdateInterval?: number;
}

export interface VersionInfo {
  hash: string;
  version: string;
}

export interface NodeInfo {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  weight: number;
  price: number;
  billing_cycle: number;
  auto_renewal: boolean;
  currency: string;
  expired_at: string | null;
  group: string;
  tags: string;
  public_remark: string;
  hidden: boolean;
  traffic_limit: number;
  traffic_limit_type: string;
  created_at: string;
  updated_at: string;
}

export interface RealtimeStatus {
  cpu: { usage: number };
  ram: { total: number; used: number };
  swap: { total: number; used: number };
  load: { load1: number; load5: number; load15: number };
  disk: { total: number; used: number };
  network: {
    up: number;
    down: number;
    totalUp: number;
    totalDown: number;
  };
  connections: { tcp: number; udp: number };
  uptime: number;
  process: number;
  message: string;
  updated_at: string;
}

export interface WebSocketRealtimeResponse {
  status: "success" | "error";
  data: {
    online: string[];
    data: Record<string, RealtimeStatus>;
  };
}

export interface LoadRecord {
  client: string;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  temp: number;
  disk: number;
  disk_total: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;
  connections_udp: number;
}

export interface LoadRecordsResponse {
  count: number;
  records: LoadRecord[];
}

export interface PingRecord {
  task_id: number;
  time: string;
  value: number;
}

export interface PingTask {
  id: number;
  interval: number;
  name: string;
  loss: number;
}

export interface PingRecordsResponse {
  count: number;
  records: PingRecord[];
  tasks: PingTask[];
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
}

export class ApiError extends Error {
  status: string;
  code?: number;
  constructor(message: string, status: string = "error", code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ==================== API Client ====================

export class KomariApi {
  private baseUrl: string;
  private timeout: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.NEXT_PUBLIC_API_BASE ||
      "/api";
    this.timeout = options.timeout || 30000;
  }

  private async get<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const result: ApiResponse<T> = await response.json();
      if (result.status === "error") {
        throw new ApiError(
          result.message || "Unknown error",
          "error",
          response.status,
        );
      }
      return result.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  private async getRaw<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new ApiError(`HTTP error: ${response.status}`, "error", response.status);
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  async getMe(): Promise<MeInfo> {
    return this.getRaw<MeInfo>("/me");
  }

  async getPublicSettings(): Promise<PublicSettings> {
    return this.get<PublicSettings>("/public");
  }

  async getVersion(): Promise<VersionInfo> {
    return this.get<VersionInfo>("/version");
  }

  async getNodes(): Promise<NodeInfo[]> {
    return this.get<NodeInfo[]>("/nodes");
  }

  async getNodeRecentStatus(uuid: string): Promise<RealtimeStatus[]> {
    return this.get<RealtimeStatus[]>(`/recent/${uuid}`);
  }

  async getLoadRecords(uuid: string, hours: number): Promise<LoadRecordsResponse> {
    return this.get<LoadRecordsResponse>("/records/load", { uuid, hours });
  }

  async getPingRecords(uuid: string, hours: number): Promise<PingRecordsResponse> {
    return this.get<PingRecordsResponse>("/records/ping", { uuid, hours });
  }
}

let sharedApiInstance: KomariApi | null = null;
export function getSharedApi(options?: ApiClientOptions): KomariApi {
  if (!sharedApiInstance) sharedApiInstance = new KomariApi(options);
  return sharedApiInstance;
}
export function resetSharedApi(): void {
  sharedApiInstance = null;
}
export default KomariApi;

// ==================== Realtime WebSocket (kept as utility) ====================

export class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private listeners: Set<(data: WebSocketRealtimeResponse) => void> = new Set();
  private errorListeners: Set<(error: Event) => void> = new Set();
  private isOpen = false;

  constructor(
    options: {
      baseUrl?: string;
      reconnectInterval?: number;
      maxReconnectAttempts?: number;
    } = {},
  ) {
    const baseUrl = options.baseUrl || "/api/clients";
    this.url = baseUrl
      .replace(HTTP_PROTOCOL_REGEX, "ws")
      .replace(HTTPS_PROTOCOL_REGEX, "wss");
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isOpen = true;
          this.reconnectAttempts = 0;
          this.ws!.send("get");
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketRealtimeResponse = JSON.parse(event.data);
            this.listeners.forEach((l) => l(data));
          } catch {
            // ignore
          }
        };
        this.ws.onerror = (error) => {
          this.errorListeners.forEach((l) => l(error));
          if (!this.isOpen) reject(new ApiError("WebSocket connection failed", "error"));
        };
        this.ws.onclose = () => {
          this.isOpen = false;
          this.attemptReconnect();
        };
      } catch (error) {
        reject(
          new ApiError(
            `WebSocket error: ${error instanceof Error ? error.message : String(error)}`,
            "error",
          ),
        );
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => undefined);
      }, this.reconnectInterval);
    }
  }

  requestData(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send("get");
    }
  }

  subscribe(
    callback: (data: WebSocketRealtimeResponse) => void,
  ): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onError(callback: (error: Event) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isOpen = false;
    this.listeners.clear();
    this.errorListeners.clear();
  }

  get connected(): boolean {
    return this.isOpen && this.ws?.readyState === WebSocket.OPEN;
  }
}