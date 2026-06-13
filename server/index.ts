/**
 * 蓉才通™ ATOS 后端服务入口
 * Express + WebSocket + AI Agent Pipeline
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { requestLogger } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { tenantIsolation } from './middleware/tenant';
import { errorHandler } from './middleware/error';
import { rateLimiter } from './middleware/rateLimit';
import trustRoutes from './routes/trust';
import hiringRoutes from './routes/hiring';
import auditRoutes from './routes/audit';
import aiRoutes from './routes/ai';
import healthRoutes from './routes/health';
import v2Router from './routes/v2/index';
import { eventBus } from './ai/shared/events/bus';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Request-Id'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);

// 公开路由
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/trust', trustRoutes);

// 受保护路由 v1
app.use('/api/v1/hiring', authMiddleware, tenantIsolation, hiringRoutes);
app.use('/api/v1/audit', authMiddleware, tenantIsolation, auditRoutes);
app.use('/api/v1/ai', authMiddleware, tenantIsolation, aiRoutes);

// AI v2 路由（Interview OS / Resume Intelligence / PeopleGPT / Copilot）
app.use('/api/v2', v2Router);

app.use(errorHandler);

// ─── HTTP + WebSocket Server ─────────────────────────────────────────────────
const server = createServer(app);

// WebSocket for Interview real-time communication
// Using native ws module for production-grade WebSocket
type WSClient = import('ws').WebSocket;
let WebSocketServer: typeof import('ws').WebSocketServer;
let WS_OPEN: number;

async function initWebSocket() {
  try {
    const ws = await import('ws');
    WebSocketServer = ws.WebSocketServer;
    WS_OPEN = ws.WebSocket.OPEN;

    const wss = new WebSocketServer({ server, path: '/ws' });
    const sessionClients = new Map<string, Set<WSClient>>();

    wss.on('connection', (client: WSClient, req) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      const pathParts = url.pathname.split('/');
      // Expected: /ws/interview/{sessionId}
      const sessionId = pathParts[3] || pathParts[2] || null;

      if (!sessionId) {
        client.close(4001, 'Missing sessionId');
        return;
      }

      if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
      sessionClients.get(sessionId)!.add(client);

      client.send(JSON.stringify({ type: 'connected', data: { sessionId } }));

      client.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'audio_chunk') {
            const { interviewOrchestrator } = await import('./ai/interview/orchestrator');
            await interviewOrchestrator.processAudioChunk({
              sessionId,
              audioUrl: msg.data.audio,
              format: msg.data.format || 'webm',
              chunkIndex: msg.data.chunkIndex || 0,
            });
          } else if (msg.type === 'join') {
            // Acknowledge join
            client.send(JSON.stringify({ type: 'joined', data: { role: msg.role, sessionId } }));
          }
        } catch (err) {
          client.send(JSON.stringify({ type: 'error', data: { message: (err as Error).message } }));
        }
      });

      client.on('close', () => {
        sessionClients.get(sessionId)?.delete(client);
        if (sessionClients.get(sessionId)?.size === 0) sessionClients.delete(sessionId);
      });
    });

    // Bridge EventBus → WebSocket clients
    const interviewEvents = [
      'interview:transcript', 'interview:star_detected', 'interview:competency_signal',
      'interview:followup', 'interview:score_update', 'interview:completed', 'interview:timer_update',
    ];
    for (const eventType of interviewEvents) {
      eventBus.subscribe(eventType, (payload: Record<string, unknown>) => {
        const sid = payload.sessionId as string;
        const clients = sessionClients.get(sid);
        if (!clients) return;
        const msg = JSON.stringify({ type: eventType, data: payload.data || payload });
        for (const c of clients) {
          if (c.readyState === WS_OPEN) c.send(msg);
        }
      });
    }

    console.log(`[ATOS Server] WebSocket → ws://localhost:${PORT}/ws`);
  } catch (err) {
    console.warn('[ATOS Server] WebSocket not available (ws package missing), SSE-only mode');
  }
}

// Start server
server.listen(PORT, async () => {
  console.log(`[ATOS Server] 蓉才通后端服务已启动 → http://localhost:${PORT}`);
  console.log(`[ATOS Server] AI v2 API → http://localhost:${PORT}/api/v2`);
  console.log(`[ATOS Server] 环境: ${process.env.NODE_ENV || 'development'}`);
  await initWebSocket();
});

export default app;
