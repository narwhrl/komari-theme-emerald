/**
 * Komari RPC2 Client SDK — Next.js port.
 * - HTTP-only client (no browser-side WebSocket fallback): we run as a static
 *   site embedded into Komari; HTTP-only avoids WS-origin quirks and Safari
 *   URL strictness.
 * - For realtime push, use the dedicated `/api/clients` WebSocket via
 *   {@link RealtimeWebSocket} in `./api.ts`.
 * @see https://www.komari.wiki/dev/rpc.html
 */

const HTTP_PROTOCOL_PREFIX = "http://";
const HTTPS_PROTOCOL_PREFIX = "https://";
const WS_PROTOCOL_PREFIX = "ws://";
const WSS_PROTOCOL_PREFIX = "wss://";
const DEFAULT_RPC_API_BASE = "/api";
const DEFAULT_RPC_ENDPOINT = `${DEFAULT_RPC_API_BASE}/rpc2`;

function normalizeHttpBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return DEFAULT_RPC_ENDPOINT;
  if (trimmed.startsWith(WS_PROTOCOL_PREFIX))
    return `${HTTP_PROTOCOL_PREFIX}${trimmed.slice(WS_PROTOCOL_PREFIX.length)}`;
  if (trimmed.startsWith(WSS_PROTOCOL_PREFIX))
    return `${HTTPS_PROTOCOL_PREFIX}${trimmed.slice(WSS_PROTOCOL_PREFIX.length)}`;
  return trimmed;
}

// ==================== Types ====================

export interface MethodMeta {
  name: string;
  summary: string;
  description: string;
  params: { name: string; type: string; description: string }[];
  returns: string;
}

export interface Client {
  uuid: string;
  token?: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name?: string;
  ipv4?: string;
  ipv6?: string;
  region: string;
  remark?: string;
  public_remark: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version?: string;
  weight: number;
  price: number;
  billing_cycle: number;
  auto_renewal: boolean;
  currency: string;
  expired_at: string;
  group: string;
  tags: string;
  hidden: boolean;
  traffic_limit: number;
  traffic_limit_type: string;
  created_at: string;
  updated_at: string;
}

export interface PublicInfo {
  allow_cors: boolean;
  custom_body: string;
  custom_head: string;
  description: string;
  disable_password_login: boolean;
  oauth_enable: boolean;
  oauth_provider: string;
  ping_record_preserve_time: number;
  private_site: boolean;
  record_enabled: boolean;
  record_preserve_time: number;
  sitename: string;
  theme: string;
  theme_settings: Record<string, unknown>;
}

export interface VersionInfo {
  version: string;
  hash: string;
}

export interface NodeStatusPing {
  name: string;
  latest: number;
  avg: number;
  tail: number;
  loss: number;
  min: number;
  max: number;
}

export interface NodeStatus {
  client: string;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  load5: number;
  load15: number;
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
  online: boolean;
  uptime: number;
  ping?: Record<string, NodeStatusPing>;
}

export interface StatusRecord {
  client: string;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  load5: number;
  load15: number;
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

export interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
  id: number | string;
}

interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  result: T;
  id: number | string;
}

interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  error: { code: number; message: string; data?: unknown };
  id: number | string | null;
}

type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

export class RpcError extends Error {
  code: number;
  data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

interface RpcClientOptions {
  baseUrl?: string;
  timeout?: number;
}

export class RpcClient {
  private baseUrl: string;
  private timeout: number;
  private requestId = 0;

  constructor(options: RpcClientOptions = {}) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || DEFAULT_RPC_API_BASE;
    this.baseUrl = normalizeHttpBaseUrl(options.baseUrl || `${apiBase}/rpc2`);
    this.timeout = options.timeout || 30000;
  }

  private async callHttp<T>(
    method: string,
    params?: Record<string, unknown> | unknown[],
  ): Promise<T> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = { jsonrpc: "2.0", method, params, id };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
        credentials: "include",
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new RpcError(response.status, `HTTP error: ${response.status}`);
      }
      const data: JsonRpcResponse<T> = await response.json();
      return this.handleResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof RpcError) throw error;
      throw new RpcError(
        -32000,
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private handleResponse<T>(response: JsonRpcResponse<T>): T {
    if ("error" in response) {
      throw new RpcError(response.error.code, response.error.message, response.error.data);
    }
    return response.result;
  }

  async call<T>(
    method: string,
    params?: Record<string, unknown> | unknown[],
  ): Promise<T> {
    return this.callHttp<T>(method, params);
  }
}

export class KomariRpc {
  private client: RpcClient;

  constructor(options: RpcClientOptions = {}) {
    this.client = new RpcClient(options);
  }

  getClient(): RpcClient {
    return this.client;
  }

  async getMethods(): Promise<string[]> {
    return this.client.call<string[]>("rpc.getMethods");
  }
  async getHelp(): Promise<MethodMeta[]> {
    return this.client.call<MethodMeta[]>("rpc.getHelp");
  }
  async ping(): Promise<string> {
    return this.client.call<string>("rpc.ping");
  }
  async getVersion(): Promise<VersionInfo> {
    return this.client.call<VersionInfo>("rpc.getVersion");
  }
  async getNodes(): Promise<Record<string, Client>> {
    return this.client.call<Record<string, Client>>("common:getNodes");
  }
  async getNodesLatestStatus(): Promise<Record<string, NodeStatus>> {
    return this.client.call<Record<string, NodeStatus>>(
      "common:getNodesLatestStatus",
    );
  }
  async getNodeRecentStatus(
    uuid: string,
    limit?: number,
  ): Promise<{ count: number; records: StatusRecord[] }> {
    return this.client.call<{ count: number; records: StatusRecord[] }>(
      "common:getNodeRecentStatus",
      { uuid, limit },
    );
  }
  async getPublicInfo(): Promise<PublicInfo> {
    return this.client.call<PublicInfo>("common:getPublicInfo");
  }
  async getBackendVersion(): Promise<VersionInfo> {
    return this.client.call<VersionInfo>("common:getBackendVersion");
  }
  async getLoadRecords(
    uuid?: string,
    hours?: number,
    loadType?: string,
    maxCount?: number,
  ): Promise<{ records: StatusRecord[] }> {
    return this.client.call<{ records: StatusRecord[] }>("common:getRecords", {
      type: "load",
      uuid,
      hours,
      load_type: loadType,
      max_count: maxCount,
    });
  }
  async getPingRecords(
    taskId?: number,
    hours?: number,
    maxCount?: number,
  ): Promise<{ records: PingRecord[] }> {
    return this.client.call<{ records: PingRecord[] }>("common:getRecords", {
      type: "ping",
      task_id: taskId,
      hours,
      max_count: maxCount,
    });
  }
  close(): void {
    /* no-op in HTTP-only mode */
  }
}

let sharedRpc: KomariRpc | null = null;
export function getSharedRpc(): KomariRpc {
  if (!sharedRpc) sharedRpc = new KomariRpc();
  return sharedRpc;
}
export function resetSharedRpc(): void {
  sharedRpc = null;
}