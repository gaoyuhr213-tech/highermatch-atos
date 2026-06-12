/**
 * 蓉才通™ ATOS 后端服务入口
 * Express + TypeScript
 */
import express from 'express';
import cors from 'cors';
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

// 受保护路由
app.use('/api/v1/hiring', authMiddleware, tenantIsolation, hiringRoutes);
app.use('/api/v1/audit', authMiddleware, tenantIsolation, auditRoutes);
app.use('/api/v1/ai', authMiddleware, tenantIsolation, aiRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ATOS Server] 蓉才通后端服务已启动 → http://localhost:${PORT}`);
  console.log(`[ATOS Server] 环境: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
