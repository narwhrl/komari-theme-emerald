/**
 * Application initialization — Next.js port of the original `init.ts`.
 * Owns the lifecycle: health check → public settings → user info → nodes →
 * websocket connect → polling loop. Returns a destroy function.
 *
 * Uses TanStack Query internally for transport (so we get caching, retries,
 * abort signals, and Suspense support).
 */
"use client";

import { getSharedApi, ApiError } from "@/utils/api";
import { getSharedRpc, RpcError } from "@/utils/rpc";
import { useAppStore } from "@/stores/app";
import { useNodesStore } from "@/stores/nodes";
import type { Client, NodeStatus } from "@/utils/rpc";

interface InitConfig {
  wsReconnectInterval?: number;
  wsMaxReconnectAttempts?: number;
  healthCheckTimeout?: number;
  postFailureThreshold?: number;
}

const DEFAULT_CONFIG: Required<InitConfig> = {
  wsReconnectInterval: 3000,
  wsMaxReconnectAttempts: 5,
  healthCheckTimeout: 5000,
  postFailureThreshold: 3,
};

class InitManager {
  private config: Required<InitConfig>;
  private rpc = getSharedRpc();
  private api = getSharedApi();
  private appStore = useAppStore;
  private nodesStore = useNodesStore;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isPolling = false;
  private isInitialized = false;
  private useWebSocket: boolean | null = null;
  private realtimeWs: WebSocket | null = null;
  private unmounted = false;

  constructor(config: InitConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getPollInterval(): number {
    const settings =
      this.appStore.getState().publicSettings?.theme_settings;
    const interval =
      typeof settings === "object" && settings !== null
        ? (settings as Record<string, unknown>).dataUpdateInterval
        : undefined;
    if (typeof interval === "number" && interval >= 1 && interval <= 60) {
      return interval * 1000;
    }
    return 3000;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[InitManager] Already initialized");
      return;
    }
    try {
      await this.healthCheck();
      await this.fetchPublicSettings();
      await this.fetchUserInfo();
      await this.fetchNodesData();

      this.appStore.getState().setLoading(false);
      this.startWebSocketAndPolling();
      this.isInitialized = true;
    } catch (error) {
      console.error("[InitManager] Initialization failed:", error);
      this.appStore.getState().setLoading(false);
      throw error;
    }
  }

  private async healthCheck(): Promise<void> {
    try {
      const result = await this.rpc.ping();
      if (result !== "pong") {
        throw new RpcError(-32000, "Unexpected health check response");
      }
    } catch (error) {
      if (error instanceof RpcError && error.code === 401) {
        console.warn("[InitManager] Private site, redirecting to /admin");
        this.appStore.getState().setLoggedIn(false);
        this.appStore.getState().setLoading(false);
        if (typeof window !== "undefined") {
          window.location.href = "/admin";
        }
        return;
      }
      console.error("[InitManager] Health check failed:", error);
      this.appStore.getState().setConnectionError(true);
      throw new Error("Backend service unavailable");
    }
  }

  private async fetchPublicSettings(): Promise<void> {
    try {
      const s = await this.api.getPublicSettings();
      this.appStore.getState().setPublicSettings(s);
    } catch (error) {
      console.error("[InitManager] Failed to fetch public settings:", error);
    }
  }

  private async fetchUserInfo(): Promise<void> {
    try {
      const u = await this.api.getMe();
      this.appStore.getState().setLoggedIn(u.logged_in);
    } catch (error) {
      this.appStore.getState().setLoggedIn(false);
      console.error("[InitManager] Failed to fetch user info:", error);
    }
  }

  private async fetchNodesData(): Promise<void> {
    const [clientsResult, statusesResult] = await Promise.all([
      this.rpc.getNodes() as Promise<Record<string, Client>>,
      this.rpc.getNodesLatestStatus() as Promise<Record<string, NodeStatus>>,
    ]);
    this.nodesStore.getState().initNodes(clientsResult, statusesResult);
  }

  private startWebSocketAndPolling(): void {
    this.clearReconnectTimer();
    const mode = this.appStore.getState().getRpcTransportMode();
    this.useWebSocket = mode === "websocket";
    if (this.useWebSocket) {
      this.connectWebSocket();
    } else {
      this.nodesStore.getState().updateWsState(
        "disconnected",
        this.config.wsMaxReconnectAttempts,
      );
    }
    this.startPolling();
  }

  private connectWebSocket(): void {
    if (this.unmounted || this.useWebSocket === false) return;

    this.nodesStore.getState().updateWsState(
      "connecting",
      this.nodesStore.getState().wsReconnectAttempts,
    );

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "/api";
    const wsBase = apiBase
      .replace(/^http/i, (m) =>
        m.toLowerCase() === "http" ? "ws" : "wss",
      )
      .replace(/^https/i, "wss");
    const wsUrl = `${wsBase}/clients`;

    try {
      const ws = new WebSocket(wsUrl);
      this.realtimeWs = ws;
      ws.onopen = () => {
        if (this.unmounted) {
          ws.close();
          return;
        }
        this.nodesStore.getState().updateWsState("connected", 0);
        this.clearReconnectTimer();
        this.appStore.getState().setConnectionError(false);
        ws.send("get");
      };
      ws.onerror = () => {
        if (!this.unmounted) {
          this.nodesStore.getState().updateWsState("disconnected");
          this.scheduleReconnect();
        }
      };
      ws.onclose = () => {
        if (!this.unmounted) {
          this.nodesStore.getState().updateWsState("disconnected");
          this.scheduleReconnect();
        }
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.data?.data) {
            const map = payload.data.data as Record<string, NodeStatus>;
            this.nodesStore.getState().updateNodeStatuses(map);
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.useWebSocket !== true || this.reconnectTimer) return;
    const attempts = this.nodesStore.getState().wsReconnectAttempts;
    if (attempts >= this.config.wsMaxReconnectAttempts) {
      this.fallbackToPostMode();
      return;
    }
    this.nodesStore
      .getState()
      .updateWsState("reconnecting", attempts + 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.useWebSocket === true && !this.unmounted) {
        this.connectWebSocket();
      }
    }, this.config.wsReconnectInterval);
  }

  private fallbackToPostMode(): void {
    this.useWebSocket = false;
    this.clearReconnectTimer();
    this.nodesStore
      .getState()
      .updateWsState("disconnected", this.config.wsMaxReconnectAttempts);
    if (this.realtimeWs) {
      this.realtimeWs.close();
      this.realtimeWs = null;
    }
    if (typeof window !== "undefined") {
      window.$message?.warning(
        "WebSocket 无法连接，已回落至轮询模式。",
      );
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.poll(), this.getPollInterval());
  }

  private async poll(): Promise<void> {
    if (this.isPolling || this.unmounted) return;
    this.isPolling = true;
    try {
      const [, clientsResult, statusesResult] = await Promise.all([
        this.rpc.ping(),
        this.rpc.getNodes() as Promise<Record<string, Client>>,
        this.rpc.getNodesLatestStatus() as Promise<Record<string, NodeStatus>>,
      ]);
      this.nodesStore.getState().updateNodeClients(clientsResult);
      this.nodesStore.getState().updateNodeStatuses(statusesResult);
      this.appStore.getState().setConnectionError(false);
    } catch (error) {
      console.error("[InitManager] Poll error:", error);
      this.appStore.getState().setConnectionError(true);
    } finally {
      this.isPolling = false;
    }
  }

  destroy(): void {
    this.unmounted = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.clearReconnectTimer();
    if (this.realtimeWs) {
      this.realtimeWs.close();
      this.realtimeWs = null;
    }
    this.rpc.close();
    this.nodesStore.getState().clearNodes();
    this.isInitialized = false;
  }
}

let initManager: InitManager | null = null;

export async function initApp(): Promise<void> {
  if (!initManager) initManager = new InitManager();
  await initManager.init();
}

export function destroyInitManager(): void {
  if (initManager) {
    initManager.destroy();
    initManager = null;
  }
}

export function getInitManager(): InitManager | null {
  return initManager;
}

export { ApiError };