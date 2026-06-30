'use client'

import type { Client, NodeStatus, NodeStatusPing } from '@/utils/rpc'
import { create } from 'zustand'
import { parseNodeGroups } from '@/utils/groupHelper'

export type TrafficLimitType = 'up' | 'down' | 'min' | 'max' | 'sum'

export interface NodeData {
  uuid: string
  name: string
  cpu_name: string
  virtualization: string
  arch: string
  cpu_cores: number
  os: string
  kernel_version: string
  gpu_name?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: TrafficLimitType
  created_at: string
  updated_at: string
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
}

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface StatusData {
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
}

interface NodesStoreState {
  nodes: NodeData[]
  earthNodes: NodeData[]
  wsConnectionState: WsConnectionState
  wsReconnectAttempts: number
  lastEarthSnapshotAt: number
}

interface NodesStoreActions {
  initNodes: (clients: Record<string, Client>, statuses: Record<string, NodeStatus>) => void
  updateNodeStatuses: (statuses: Record<string, NodeStatus>) => void
  updateNodeClients: (clients: Record<string, Client>) => void
  updateWsState: (state: WsConnectionState, attempts?: number) => void
  clearNodes: () => void
}

export type NodesStore = NodesStoreState & NodesStoreActions

const EARTH_SNAPSHOT_INTERVAL_MS = 60_000

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
    time: '',
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
  }
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
  }
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
  }
}

function sortNodesByWeight(nodes: NodeData[]): NodeData[] {
  return [...nodes].sort((a, b) => a.weight - b.weight)
}

function refreshEarthNodes(state: NodesStoreState, nextNodes: NodeData[], force = false): Pick<NodesStoreState, 'earthNodes' | 'lastEarthSnapshotAt'> {
  const now = Date.now()
  if (!force && now - state.lastEarthSnapshotAt < EARTH_SNAPSHOT_INTERVAL_MS) {
    return {
      earthNodes: state.earthNodes,
      lastEarthSnapshotAt: state.lastEarthSnapshotAt,
    }
  }

  return {
    earthNodes: [...nextNodes],
    lastEarthSnapshotAt: now,
  }
}

export const useNodesStore = create<NodesStore>((set, get) => ({
  nodes: [],
  earthNodes: [],
  wsConnectionState: 'disconnected',
  wsReconnectAttempts: 0,
  lastEarthSnapshotAt: 0,

  initNodes: (clients, statuses) => set((state) => {
    const nextNodes = [...state.nodes]
    const uuids = Object.keys(clients)
    const existingUuids = new Set(nextNodes.map(node => node.uuid))

    uuids.forEach((uuid) => {
      const client = clients[uuid]
      if (!client)
        return

      const status = statuses[uuid]
      const index = nextNodes.findIndex(node => node.uuid === uuid)
      const baseNode = createNodeFromClient(client)
      const nextNode = status ? updateNodeStatus(baseNode, extractStatusData(status)) : baseNode

      if (existingUuids.has(uuid) && index !== -1)
        nextNodes[index] = nextNode
      else
        nextNodes.push(nextNode)
    })

    const newUuids = new Set(uuids)
    const sortedNodes = sortNodesByWeight(nextNodes.filter(node => newUuids.has(node.uuid)))
    return {
      nodes: sortedNodes,
      ...refreshEarthNodes(state, sortedNodes, true),
    }
  }),
  updateNodeStatuses: statuses => set((state) => {
    let hasChanges = false
    const nextNodes = state.nodes.map((node) => {
      const status = statuses[node.uuid]
      if (!status)
        return node
      hasChanges = true
      return updateNodeStatus(node, extractStatusData(status))
    })

    return {
      nodes: nextNodes,
      ...(hasChanges ? refreshEarthNodes(state, nextNodes) : {}),
    }
  }),
  updateNodeClients: clients => set((state) => {
    const existing = new Map(state.nodes.map(node => [node.uuid, node]))
    const nextNodes = Object.entries(clients).map(([uuid, client]) => {
      const currentNode = existing.get(uuid)
      const baseNode = createNodeFromClient(client)
      return currentNode
        ? updateNodeStatus(baseNode, {
            online: currentNode.online,
            time: currentNode.time,
            cpu: currentNode.cpu,
            gpu: currentNode.gpu,
            ram: currentNode.ram,
            swap: currentNode.swap,
            load: currentNode.load,
            load5: currentNode.load5,
            load15: currentNode.load15,
            temp: currentNode.temp,
            disk: currentNode.disk,
            net_in: currentNode.net_in,
            net_out: currentNode.net_out,
            net_total_up: currentNode.net_total_up,
            net_total_down: currentNode.net_total_down,
            process: currentNode.process,
            connections: currentNode.connections,
            connections_udp: currentNode.connections_udp,
            uptime: currentNode.uptime,
            ping: currentNode.ping,
          })
        : baseNode
    })
    const sortedNodes = sortNodesByWeight(nextNodes)
    return {
      nodes: sortedNodes,
      ...refreshEarthNodes(state, sortedNodes, true),
    }
  }),
  updateWsState: (state, attempts) => set({
    wsConnectionState: state,
    ...(attempts !== undefined ? { wsReconnectAttempts: attempts } : {}),
  }),
  clearNodes: () => {
    const state = get()
    set({
      nodes: [],
      ...refreshEarthNodes(state, [], true),
    })
  },
}))

export function selectNodeGroups(nodes: NodeData[]): string[] {
  const groupSet = new Set<string>()
  nodes.forEach((node) => {
    parseNodeGroups(node.group).forEach(group => groupSet.add(group))
  })
  return Array.from(groupSet)
}

export function selectNodesByUuid(nodes: NodeData[]): Map<string, NodeData> {
  return new Map(nodes.map(node => [node.uuid, node]))
}
