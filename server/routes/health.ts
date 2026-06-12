import { Router } from 'express';
const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'healthy', service: 'atos-backend', version: '4.0.0', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

router.get('/ready', (_req, res) => {
  res.json({ ready: true });
});

export default router;
