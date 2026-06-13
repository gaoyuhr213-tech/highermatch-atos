/**
 * 蓉才通™ ATOS — PeopleGPT API v2
 */

import { Router, type Request, type Response } from 'express';
import { searchAgent, type SearchQuery } from '../../ai/people/agents/search-agent';
import { outreachAgent, type OutreachInput } from '../../ai/people/agents/outreach-agent';
import type { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

/**
 * POST /api/v2/people/search
 * Natural language talent search
 */
router.post('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, filters, limit, offset } = req.body;

    if (!query) {
      return res.status(400).json({ code: 'PPL_001', message: 'query is required' });
    }

    const searchInput: SearchQuery = {
      naturalLanguage: query,
      tenantId: req.user?.tenantId || '',
      filters,
      limit: limit || 20,
      offset: offset || 0,
    };

    const results = await searchAgent.search(searchInput);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ code: 'PPL_500', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/people/search/parse
 * Parse natural language query without executing search
 */
router.post('/search/parse', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, filters } = req.body;
    const structured = await searchAgent.parseQuery({
      naturalLanguage: query,
      tenantId: req.user?.tenantId || '',
      filters,
    });
    res.json({ success: true, data: structured });
  } catch (error) {
    res.status(500).json({ code: 'PPL_501', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/people/outreach
 * Generate personalized outreach email
 */
router.post('/outreach', async (req: Request, res: Response) => {
  try {
    const input = req.body as OutreachInput;
    if (!input.candidateProfile || !input.position) {
      return res.status(400).json({ code: 'PPL_010', message: 'candidateProfile and position required' });
    }
    const result = await outreachAgent.generateEmail(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ code: 'PPL_510', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/people/outreach/sequence
 * Generate complete outreach sequence (3-5 emails)
 */
router.post('/outreach/sequence', async (req: Request, res: Response) => {
  try {
    const { candidateProfile, position, senderProfile, tone, language, steps } = req.body;
    if (!candidateProfile || !position) {
      return res.status(400).json({ code: 'PPL_011', message: 'candidateProfile and position required' });
    }
    const sequence = await outreachAgent.generateSequence(
      { candidateProfile, position, senderProfile, tone: tone || 'professional', language: language || 'zh' },
      steps || 4
    );
    res.json({ success: true, data: sequence });
  } catch (error) {
    res.status(500).json({ code: 'PPL_511', message: (error as Error).message });
  }
});

export default router;
