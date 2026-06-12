import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
const router = Router();

router.post('/resume/parse', (req: AuthenticatedRequest, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ code: 'AI_001', message: '简历内容不能为空' });
  res.json({ parsed: true, skills: [], experience: [], education: [], tenantId: req.user?.tenantId });
});

router.post('/match', (req: AuthenticatedRequest, res) => {
  res.json({ score: 0, dimensions: { skills: 0, experience: 0, culture: 0 }, tenantId: req.user?.tenantId });
});

router.post('/interview/score', (req: AuthenticatedRequest, res) => {
  const { interviewId } = req.body;
  if (!interviewId) return res.status(400).json({ code: 'AI_002', message: '面试ID必填' });
  res.json({ interviewId, score: 0, recommendation: 'pending', tenantId: req.user?.tenantId });
});

router.post('/risk/detect', (req: AuthenticatedRequest, res) => {
  const { candidateId } = req.body;
  res.json({ candidateId, riskLevel: 'low', factors: [], tenantId: req.user?.tenantId });
});

export default router;
