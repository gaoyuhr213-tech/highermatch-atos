/**
 * 蓉才通™ ATOS — Event Bus
 * 
 * 实时事件分发系统，支持：
 * - WebSocket（面试实时数据）
 * - SSE（单向推送）
 * - Internal Pub/Sub（Agent间通信）
 * 
 * Event Types:
 * - interview:transcript    → 新转写文本
 * - interview:score_update  → 实时评分更新
 * - interview:followup      → AI追问生成
 * - interview:star_detected → STAR结构识别
 * - interview:completed     → 面试结束
 * - resume:parsed           → 简历解析完成
 * - resume:scored           → 简历评分完成
 * - sourcing:result         → 寻访结果
 * - sourcing:outreach_sent  → 触达已发送
 * - agent:thinking          → Agent思考中
 * - agent:response          → Agent响应
 */

import { EventEmitter } from 'events';

export type EventType =
  | 'interview:transcript'
  | 'interview:score_update'
  | 'interview:followup'
  | 'interview:star_detected'
  | 'interview:competency_signal'
  | 'interview:completed'
  | 'interview:timer_update'
  | 'resume:parsed'
  | 'resume:scored'
  | 'resume:risk_detected'
  | 'sourcing:result'
  | 'sourcing:outreach_sent'
  | 'sourcing:strategy_generated'
  | 'copilot:response'
  | 'copilot:action_plan'
  | 'agent:thinking'
  | 'agent:response'
  | 'agent:error';

export interface EventPayload {
  type: EventType;
  sessionId?: string;
  tenantId: string;
  timestamp: string;
  data: unknown;
  metadata?: {
    agentName?: string;
    latency_ms?: number;
    model?: string;
  };
}

// ─── Internal Event Bus ──────────────────────────────────────────────────────

class InternalEventBus extends EventEmitter {
  private subscribers = new Map<string, Set<(payload: EventPayload) => void>>();

  emit(event: string, payload: EventPayload): boolean {
    return super.emit(event, payload);
  }

  subscribe(eventType: EventType, handler: (payload: EventPayload) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
    this.on(eventType, handler);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(handler);
      this.off(eventType, handler);
    };
  }

  publish(payload: EventPayload): void {
    this.emit(payload.type, payload);
    // Also emit wildcard for logging/monitoring
    this.emit('*', payload);
  }

  getSubscriberCount(eventType: EventType): number {
    return this.subscribers.get(eventType)?.size || 0;
  }
}

// ─── WebSocket Connection Manager ────────────────────────────────────────────

export interface WSConnection {
  id: string;
  tenantId: string;
  sessionId?: string;
  userId: string;
  role: 'interviewer' | 'candidate' | 'observer';
  send: (data: string) => void;
  close: () => void;
}

class WebSocketManager {
  private connections = new Map<string, WSConnection>();
  private sessionConnections = new Map<string, Set<string>>(); // sessionId → connectionIds

  register(conn: WSConnection): void {
    this.connections.set(conn.id, conn);
    if (conn.sessionId) {
      if (!this.sessionConnections.has(conn.sessionId)) {
        this.sessionConnections.set(conn.sessionId, new Set());
      }
      this.sessionConnections.get(conn.sessionId)!.add(conn.id);
    }
  }

  unregister(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn?.sessionId) {
      this.sessionConnections.get(conn.sessionId)?.delete(connectionId);
    }
    this.connections.delete(connectionId);
  }

  broadcastToSession(sessionId: string, payload: EventPayload): void {
    const connIds = this.sessionConnections.get(sessionId);
    if (!connIds) return;

    const message = JSON.stringify(payload);
    for (const connId of connIds) {
      const conn = this.connections.get(connId);
      if (conn) {
        try { conn.send(message); } catch { this.unregister(connId); }
      }
    }
  }

  sendToConnection(connectionId: string, payload: EventPayload): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.send(JSON.stringify(payload));
    }
  }

  getSessionConnections(sessionId: string): WSConnection[] {
    const connIds = this.sessionConnections.get(sessionId);
    if (!connIds) return [];
    return Array.from(connIds)
      .map(id => this.connections.get(id))
      .filter(Boolean) as WSConnection[];
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

// ─── SSE Manager ─────────────────────────────────────────────────────────────

export interface SSEClient {
  id: string;
  tenantId: string;
  sessionId?: string;
  write: (data: string) => boolean;
  close: () => void;
}

class SSEManager {
  private clients = new Map<string, SSEClient>();
  private sessionClients = new Map<string, Set<string>>();

  register(client: SSEClient): void {
    this.clients.set(client.id, client);
    if (client.sessionId) {
      if (!this.sessionClients.has(client.sessionId)) {
        this.sessionClients.set(client.sessionId, new Set());
      }
      this.sessionClients.get(client.sessionId)!.add(client.id);
    }
  }

  unregister(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client?.sessionId) {
      this.sessionClients.get(client.sessionId)?.delete(clientId);
    }
    this.clients.delete(clientId);
  }

  sendEvent(sessionId: string, event: string, data: unknown): void {
    const clientIds = this.sessionClients.get(sessionId);
    if (!clientIds) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        const ok = client.write(message);
        if (!ok) this.unregister(clientId);
      }
    }
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────

export const eventBus = new InternalEventBus();
export const wsManager = new WebSocketManager();
export const sseManager = new SSEManager();

// Wire event bus to WebSocket broadcast
eventBus.subscribe('interview:transcript', (payload) => {
  if (payload.sessionId) wsManager.broadcastToSession(payload.sessionId, payload);
});
eventBus.subscribe('interview:score_update', (payload) => {
  if (payload.sessionId) wsManager.broadcastToSession(payload.sessionId, payload);
});
eventBus.subscribe('interview:followup', (payload) => {
  if (payload.sessionId) wsManager.broadcastToSession(payload.sessionId, payload);
});
eventBus.subscribe('interview:star_detected', (payload) => {
  if (payload.sessionId) wsManager.broadcastToSession(payload.sessionId, payload);
});
eventBus.subscribe('interview:competency_signal', (payload) => {
  if (payload.sessionId) wsManager.broadcastToSession(payload.sessionId, payload);
});
