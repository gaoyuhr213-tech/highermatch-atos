/**
 * 蓉才通™ ATOS — Workflow Multi-Agent API Routes
 * 
 * Exposes workflow execution, status, resume, cancel, and audit trail endpoints.
 */

import { Router, Request, Response } from 'express';
import { WorkflowOrchestrator, INTERVIEW_WORKFLOW, RESUME_SCREENING_WORKFLOW, PEOPLE_SEARCH_WORKFLOW } from '../../ai/workflow/orchestrator';
import { llm } from '../../ai/shared/llm/client';
import { redis } from '../../ai/shared/memory/redis';
import { eventBus } from '../../ai/shared/events/bus';

const router = Router();

// Singleton orchestrator (initialized on first request)
let orchestrator: WorkflowOrchestrator | null = null;

function getOrchestrator(): WorkflowOrchestrator {
  if (!orchestrator) {
    orchestrator = new WorkflowOrchestrator(llm, redis, eventBus);

    // Register pre-built workflows
    orchestrator.register(INTERVIEW_WORKFLOW);
    orchestrator.register(RESUME_SCREENING_WORKFLOW);
    orchestrator.register(PEOPLE_SEARCH_WORKFLOW);
  }
  return orchestrator;
}

/**
 * POST /api/v2/workflow/execute
 * Start a workflow execution
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { workflowId, initialState } = req.body;
    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    const orch = getOrchestrator();
    const run = await orch.execute(workflowId, initialState || {});

    res.json({
      runId: run.id,
      status: run.status,
      state: run.state,
      completedNodes: run.completedNodes,
      duration: run.completedAt ? run.completedAt - run.startedAt : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v2/workflow/runs/:runId
 * Get workflow run status
 */
router.get('/runs/:runId', (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string;
    const orch = getOrchestrator();
    const run = orch.getRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json({
      id: run.id,
      workflowId: run.workflowId,
      status: run.status,
      state: run.state,
      currentNodes: run.currentNodes,
      completedNodes: run.completedNodes,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      error: run.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v2/workflow/runs/:runId/resume
 * Resume an interrupted workflow run
 */
router.post('/runs/:runId/resume', async (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string;
    const { additionalState } = req.body;
    const orch = getOrchestrator();
    const run = await orch.resumeRun(runId, additionalState);

    res.json({
      id: run.id,
      status: run.status,
      state: run.state,
      completedNodes: run.completedNodes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v2/workflow/runs/:runId/cancel
 * Cancel a running workflow
 */
router.post('/runs/:runId/cancel', (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string;
    const orch = getOrchestrator();
    orch.cancelRun(runId);
    res.json({ status: 'cancelled', runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v2/workflow/runs/:runId/audit
 * Get audit trail for a workflow run
 */
router.get('/runs/:runId/audit', (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string;
    const orch = getOrchestrator();
    const trail = orch.getAuditTrail(runId);

    if (!trail.length) {
      return res.status(404).json({ error: 'No audit trail found' });
    }

    res.json({
      runId,
      entries: trail,
      totalNodes: trail.length,
      totalDuration: trail.reduce((sum, e) => sum + e.duration, 0),
      successRate: trail.filter(e => e.status === 'success').length / trail.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v2/workflow/definitions
 * List available workflow definitions
 */
router.get('/definitions', (_req: Request, res: Response) => {
  res.json({
    workflows: [
      { id: 'interview-full', name: 'Full Interview Pipeline', version: '1.0.0', nodes: 10, description: 'End-to-end AI interview with STAR analysis, competency evaluation, scoring, and report generation' },
      { id: 'resume-screening', name: 'Resume Screening Pipeline', version: '1.0.0', nodes: 7, description: 'Parse, analyze skills, detect risks, rank, and explain resume recommendations' },
      { id: 'people-search', name: 'PeopleGPT Search Pipeline', version: '1.0.0', nodes: 6, description: 'Natural language talent search with ranking and optional outreach generation' },
    ],
  });
});

export default router;
