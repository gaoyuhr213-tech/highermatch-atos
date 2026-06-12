import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
const router = Router();

router.get('/positions', (req: AuthenticatedRequest, res) => {
  res.json({ data: [], total: 0, page: 1, pageSize: 20, tenantId: req.user?.tenantId });
});

router.post('/positions', (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ code: 'HIRING_001', message: '岗位名称必填' });
  res.status(201).json({ id: `POS-${Date.now().toString(36)}`, title, tenantId: req.user?.tenantId, status: 'draft', createdAt: new Date().toISOString() });
});

router.get('/candidates', (req: AuthenticatedRequest, res) => {
  res.json({ data: [], total: 0, tenantId: req.user?.tenantId });
});

router.post('/interviews', (req: AuthenticatedRequest, res) => {
  const { candidateId, positionId } = req.body;
  if (!candidateId || !positionId) return res.status(400).json({ code: 'HIRING_002', message: '候选人和岗位必填' });
  res.status(201).json({ id: `INT-${Date.now().toString(36)}`, candidateId, positionId, status: 'scheduled', tenantId: req.user?.tenantId });
});

router.post('/decisions', (req: AuthenticatedRequest, res) => {
  const { decision } = req.body;
  if (!decision) return res.status(400).json({ code: 'HIRING_003', message: '决策结果必填' });
  res.status(201).json({ id: `DEC-${Date.now().toString(36)}`, decision, approvedBy: req.user?.sub, tenantId: req.user?.tenantId });
});

router.get('/funnel', (req: AuthenticatedRequest, res) => {
  res.json({ tenantId: req.user?.tenantId, stages: [{ name: '简历投递', count: 0 }, { name: '初筛通过', count: 0 }, { name: '面试', count: 0 }, { name: '录用', count: 0 }, { name: '入职', count: 0 }] });
});

export default router;
