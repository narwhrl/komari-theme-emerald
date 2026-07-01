/**
 * Nodes store — Zustand port of the original Pinia store.
 * Normalized node data, group derivation, and connection state.
 */
"use client";

import { create } from "zustand";
import type { Client, NodeStatus, NodeStatusPing } from "@/utils/rpc";
import { parseNodeGroups } from "@/utils/groupHelper";

export type TrafficLimitType = "up" | "down" | "min" | "max" | "sum";

export interface NodeData {
  uuid: string;
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
  traffic_limit_type: TrafficLimitType;
  created_at: string;
  updated_at: string;
  online: boolean;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  swap: number;
  load: number;
  load5: number;
  load15: number;
  temp: number;
  disk: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;
  connections_udp: number;
  uptime: number;
  ping?: Record<string, NodeStatusPing>;
}

export type WsConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

interface StatusData {
  online: boolean;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  swap: number;
  load: number;
  load5: number;
  load15: number;
  temp: number;
  disk: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;
  connections_udp: number;
  uptime: number;
  ping?: Record<string, NodeStatusPing>;
}

const EARTH_SNAPSHOT_INTERVAL_MS = 60_000;

function createNodeFromClient(client: Client): NodeData {
  return {
    uuid: client.uuid,
    name: client.name,
    cpu_name: client.cpu_name,
    virtualization: client.virtualization,
    arch: client.arch,
    cpu_cores: client.cpu_cores,
    os: client.os,
    kernel_version: client.kernel_version,
    gpu_name: client.gpu_name,
    ipv4: client.ipv4,
    ipv6: client.ipv6,
    region: client.region,
    remark: client.remark,
    public_remark: client.public_remark,
    mem_total: client.mem_total,
    swap_total: client.swap_total,
    disk_total: client.disk_total,
    version: client.version,
    weight: client.weight,
    price: client.price,
    billing_cycle: client.billing_cycle,
    auto_renewal: client.auto_renewal,
    currency: client.currency,
    expired_at: client.expired_at,
    group: client.group,
    tags: client.tags,
    hidden: client.hidden,
    traffic_limit: client.traffic_limit,
    traffic_limit_type: client.traffic_limit_type as TrafficLimitType,
    created_at: client.created_at,
    updated_at: client.updated_at,
    online: false,
    time: "",
    cpu: 0,
    gpu: 0,
    ram: 0,
    swap: 0,
    load: 0,
    load5: 0,
    load15: 0,
    temp: 0,
    disk: 0,
    net_in: 0,
    net_out: 0,
    net_total_up: 0,
    net_total_down: 0,
    process: 0,
    connections: 0,
    connections_udp: 0,
    uptime: 0,
    ping: undefined,
  };
}

function extractStatusData(status: NodeStatus): StatusData {
  return {
    online: status.online,
    time: status.time,
    cpu: status.cpu,
    gpu: status.gpu,
    ram: status.ram,
    swap: status.swap,
    load: status.load,
    load5: status.load5,
    load15: status.load15,
    temp: status.temp,
    disk: status.disk,
    net_in: status.net_in,
    net_out: status.net_out,
    net_total_up: status.net_total_up,
    net_total_down: status.net_total_down,
    process: status.process,
    connections: status.connections,
    connections_udp: status.connections_udp,
    uptime: status.uptime,
    ping: status.ping,
  };
}

function updateNodeStatus(node: NodeData, status: StatusData): NodeData {
  return {
    ...node,
    online: status.online,
    time: status.time,
    cpu: status.cpu,
    gpu: status.gpu,
    ram: status.ram,
    swap: status.swap,
    load: status.load,
    load5: status.load5,
    load15: status.load15,
    temp: status.temp,
    disk: status.disk,
    net_in: status.net_in,
    net_out: status.net_out,
    net_total_up: status.net_total_up,
    net_total_down: status.net_total_down,
    process: status.process,
    connections: status.connections,
    connections_udp: status.connections_udp,
    uptime: status.uptime,
    ping: status.ping,
  };
}

interface NodesStore {
  nodes: NodeData[];
  earthNodes: NodeData[];
  wsConnectionState: WsConnectionState;
  wsReconnectAttempts: number;
  onlineCount: number;
  totalCount: number;
  groups: string[];
  nodesByUuid: Map<string, NodeData>;

  initNodes: (
    clients: Record<string, Client>,
    statuses: Record<string, NodeStatus>,
  ) => void;
  updateNodeStatuses: (statuses: Record<string, NodeStatus>) => void;
  updateNodeClients: (clients: Record<string, Client>) => void;
  updateWsState: (state: WsConnectionState, attempts?: number) => void;
  clearNodes: () => void;
  refreshEarthNodes: (force?: boolean) => void;
}

let lastEarthSnapshotAt = 0;

export const useNodesStore = create<NodesStore>((set, get) => ({
  nodes: [],
  earthNodes: [],
  wsConnectionState: "disconnected",
  wsReconnectAttempts: 0,
  onlineCount: 0,
  totalCount: 0,
  groups: [],
  nodesByUuid: new Map(),

  initNodes: (clients, statuses) => {
    const current = get().nodes.slice();
    const existingUuids = new Set(current.map((n) => n.uuid));
    const newUuids = Object.keys(clients);

    newUuids.forEach((uuid) => {
      const client = clients[uuid];
      if (!client) return;
      const status = statuses[uuid];
      const base = createNodeFromClient(client);
      const merged = status ? updateNodeStatus(base, extractStatusData(status)) : base;
      const idx = current.findIndex((n) => n.uuid === uuid);
      if (idx !== -1) current[idx] = merged;
      else current.push(merged);
      existingUuids.add(uuid);
    });

    // Remove vanished nodes
    const keep = current.filter((n) => newUuids.includes(n.uuid));
    keep.sort((a, b) => a.weight - b.weight);

    const byUuid = new Map(keep.map((n) => [n.uuid, n]));
    const groups = new Set<string>();
    keep.forEach((n) =>
      parseNodeGroups(n.group).forEach((g) => groups.add(g)),
    );
    const online = keep.filter((n) => n.online).length;

    set({
      nodes: keep,
      earthNodes: [...keep],
      nodesByUuid: byUuid,
      groups: Array.from(groups),
      onlineCount: online,
      totalCount: keep.length,
    });
    lastEarthSnapshotAt = Date.now();
  },

  updateNodeStatuses: (statuses) => {
    const list = get().nodes.slice();
    let changed = false;
    for (const [uuid, status] of Object.entries(statuses)) {
      const idx = list.findIndex((n) => n.uuid === uuid);
      if (idx === -1) continue;
      const node = list[idx];
      if (!node) continue;
      list[idx] = updateNodeStatus(node, extractStatusData(status));
      changed = true;
    }
    if (!changed) return;
    const online = list.filter((n) => n.online).length;
    set({ nodes: list, onlineCount: online });
    // Refresh earth snapshot if interval elapsed
    const now = Date.now();
    if (now - lastEarthSnapshotAt >= EARTH_SNAPSHOT_INTERVAL_MS) {
      set({ earthNodes: [...list] });
      lastEarthSnapshotAt = now;
    }
  },

  updateNodeClients: (clients) => {
    const current = get().nodes.slice();
    const newUuids = new Set(Object.keys(clients));

    Object.entries(clients).forEach(([uuid, client]) => {
      const base = createNodeFromClient(client);
      const idx = current.findIndex((n) => n.uuid === uuid);
      if (idx !== -1) {
        const old = current[idx]!;
        current[idx] = updateNodeStatus(base, {
          online: old.online,
          time: old.time,
          cpu: old.cpu,
          gpu: old.gpu,
          ram: old.ram,
          swap: old.swap,
          load: old.load,
          load5: old.load5,
          load15: old.load15,
          temp: old.temp,
          disk: old.disk,
          net_in: old.net_in,
          net_out: old.net_out,
          net_total_up: old.net_total_up,
          net_total_down: old.net_total_down,
          process: old.process,
          connections: old.connections,
          connections_udp: old.connections_udp,
          uptime: old.uptime,
          ping: old.ping,
        });
      } else {
        current.push(base);
      }
    });

    const keep = current.filter((n) => newUuids.has(n.uuid));
    keep.sort((a, b) => a.weight - b.weight);

    const byUuid = new Map(keep.map((n) => [n.uuid, n]));
    const groups = new Set<string>();
    keep.forEach((n) =>
      parseNodeGroups(n.group).forEach((g) => groups.add(g)),
    );
    const online = keep.filter((n) => n.online).length;

    set({
      nodes: keep,
      earthNodes: [...keep],
      nodesByUuid: byUuid,
      groups: Array.from(groups),
      onlineCount: online,
      totalCount: keep.length,
    });
    lastEarthSnapshotAt = Date.now();
  },

  updateWsState: (state, attempts) => {
    set((s) => ({
      wsConnectionState: state,
      wsReconnectAttempts: attempts ?? s.wsReconnectAttempts,
    }));
  },

  clearNodes: () => {
    set({
      nodes: [],
      earthNodes: [],
      nodesByUuid: new Map(),
      groups: [],
      onlineCount: 0,
      totalCount: 0,
    });
    lastEarthSnapshotAt = Date.now();
  },

  refreshEarthNodes: (force) => {
    const now = Date.now();
    if (!force && now - lastEarthSnapshotAt < EARTH_SNAPSHOT_INTERVAL_MS) return;
    set({ earthNodes: [...get().nodes] });
    lastEarthSnapshotAt = now;
  },
}));