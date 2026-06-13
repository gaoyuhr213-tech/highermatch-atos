/**
 * 蓉才通™ ATOS — Candidate Copilot API v2
 */

import { Router, type Request, type Response } from 'express';
import { resumeRewriteAgent, type RewriteInput } from '../../ai/copilot/agents/resume-rewrite-agent';
import { mockInterviewAgent, type MockInterviewConfig } from '../../ai/copilot/agents/mock-interview-agent';
import { careerPlannerAgent, type CareerPlanInput } from '../../ai/copilot/agents/career-planner-agent';
import { salaryAgent, type SalaryQueryInput } from '../../ai/copilot/agents/salary-agent';
import { learningRoadmapAgent, type LearningInput } from '../../ai/copilot/agents/learning-roadmap-agent';

const router = Router();

// ─── Resume Rewrite ──────────────────────────────────────────────────────────

/**
 * POST /api/v2/copilot/resume/rewrite
 */
router.post('/resume/rewrite', async (req: Request, res: Response) => {
  try {
    const input = req.body as RewriteInput;
    if (!input.originalResume) {
      return res.status(400).json({ code: 'COP_001', message: 'originalResume required' });
    }
    const result = await resumeRewriteAgent.rewrite(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'COP_500', message: (error as Error).message });
  }
});

// ─── Mock Interview ──────────────────────────────────────────────────────────

/**
 * POST /api/v2/copilot/interview/questions
 * Generate mock interview questions
 */
router.post('/interview/questions', async (req: Request, res: Response) => {
  try {
    const { config, count } = req.body;
    if (!config?.targetPosition) {
      return res.status(400).json({ code: 'COP_010', message: 'config.targetPosition required' });
    }
    const questions = await mockInterviewAgent.generateQuestions(config as MockInterviewConfig, count || 10);
    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ code: 'COP_510', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/copilot/interview/evaluate
 * Evaluate a mock interview answer
 */
router.post('/interview/evaluate', async (req: Request, res: Response) => {
  try {
    const { question, answer, config } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ code: 'COP_011', message: 'question and answer required' });
    }
    const feedback = await mockInterviewAgent.evaluateAnswer(question, answer, config);
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ code: 'COP_511', message: (error as Error).message });
  }
});

// ─── Career Planning ─────────────────────────────────────────────────────────

/**
 * POST /api/v2/copilot/career/plan
 */
router.post('/career/plan', async (req: Request, res: Response) => {
  try {
    const input = req.body as CareerPlanInput;
    if (!input.currentProfile?.title) {
      return res.status(400).json({ code: 'COP_020', message: 'currentProfile.title required' });
    }
    const plan = await careerPlannerAgent.generatePlan(input);
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ code: 'COP_520', message: (error as Error).message });
  }
});

// ─── Salary Intelligence ─────────────────────────────────────────────────────

/**
 * POST /api/v2/copilot/salary/analyze
 */
router.post('/salary/analyze', async (req: Request, res: Response) => {
  try {
    const input = req.body as SalaryQueryInput;
    if (!input.role || !input.location) {
      return res.status(400).json({ code: 'COP_030', message: 'role and location required' });
    }
    const analysis = await salaryAgent.analyze(input);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ code: 'COP_530', message: (error as Error).message });
  }
});

// ─── Learning Roadmap ────────────────────────────────────────────────────────

/**
 * POST /api/v2/copilot/learning/roadmap
 */
router.post('/learning/roadmap', async (req: Request, res: Response) => {
  try {
    const input = req.body as LearningInput;
    if (!input.targetSkills || input.targetSkills.length === 0) {
      return res.status(400).json({ code: 'COP_040', message: 'targetSkills required' });
    }
    const roadmap = await learningRoadmapAgent.generate(input);
    res.json({ success: true, data: roadmap });
  } catch (error) {
    res.status(500).json({ code: 'COP_540', message: (error as Error).message });
  }
});

export default router;
