/**
 * 蓉才通™ ATOS — Resume Intelligence API v2
 */

import { Router, type Request, type Response } from 'express';
import { resumeParserAgent } from '../../ai/resume/agents/parser-agent';
import { skillAgent } from '../../ai/resume/agents/skill-agent';
import { riskAgent } from '../../ai/resume/agents/risk-agent';
import { rankingAgent, type RankingInput } from '../../ai/resume/agents/ranking-agent';
import { explainAgent, type ExplanationRequest } from '../../ai/resume/agents/explain-agent';
import { enqueue } from '../../ai/shared/queue/index';
import type { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

/**
 * POST /api/v2/resume/parse
 * Parse a resume into structured data
 */
router.post('/parse', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, candidateId, fileUrl, async: isAsync } = req.body;
    
    if (!content && !fileUrl) {
      return res.status(400).json({ code: 'RES_001', message: 'content or fileUrl required' });
    }

    if (isAsync && fileUrl) {
      // Async processing via queue
      const job = await enqueue('resume-parse', {
        tenantId: req.user?.tenantId || '',
        candidateId: candidateId || `cand_${Date.now()}`,
        fileUrl,
        fileType: fileUrl.endsWith('.pdf') ? 'pdf' : fileUrl.endsWith('.docx') ? 'docx' : 'txt',
      });
      return res.json({ success: true, jobId: job.id, message: 'Queued for processing' });
    }

    // Synchronous parsing
    const result = await resumeParserAgent.parse(content, candidateId || `cand_${Date.now()}`);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'RES_500', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/resume/analyze
 * Full pipeline: parse + skill + risk in one call
 */
router.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, candidateId, jdRequirements } = req.body;

    if (!content) {
      return res.status(400).json({ code: 'RES_002', message: 'content required' });
    }

    const cid = candidateId || `cand_${Date.now()}`;

    // Run pipeline
    const [parsed, skills, risk] = await Promise.all([
      resumeParserAgent.parse(content, cid),
      skillAgent.analyze(content, jdRequirements || []),
      riskAgent.assess(content),
    ]);

    res.json({
      success: true,
      data: {
        parsed,
        skills,
        risk,
        matchScore: skills.skillScore * 0.6 + (100 - risk.riskScore) * 0.4,
      },
    });
  } catch (error) {
    res.status(500).json({ code: 'RES_501', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/resume/skill-match
 * Skill extraction and matching against JD
 */
router.post('/skill-match', async (req: Request, res: Response) => {
  try {
    const { content, jdRequirements } = req.body;
    if (!content || !jdRequirements) {
      return res.status(400).json({ code: 'RES_010', message: 'content and jdRequirements required' });
    }
    const result = await skillAgent.analyze(content, jdRequirements);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'RES_510', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/resume/risk-assess
 * Risk signal detection
 */
router.post('/risk-assess', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ code: 'RES_020', message: 'content required' });
    }
    const result = await riskAgent.assess(content);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'RES_520', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/resume/rank
 * Rank multiple candidates for a position
 */
router.post('/rank', async (req: Request, res: Response) => {
  try {
    const input = req.body as RankingInput;
    if (!input.candidates || input.candidates.length === 0) {
      return res.status(400).json({ code: 'RES_030', message: 'candidates array required' });
    }
    const result = await rankingAgent.rank(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'RES_530', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/resume/explain
 * Generate explanation for a decision
 */
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const request = req.body as ExplanationRequest;
    if (!request.candidateId || !request.positionId) {
      return res.status(400).json({ code: 'RES_040', message: 'candidateId and positionId required' });
    }
    const result = await explainAgent.explain(request);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'RES_540', message: (error as Error).message });
  }
});

export default router;
