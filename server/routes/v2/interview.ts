/**
 * 蓉才通™ ATOS — Interview API v2
 * 
 * RESTful + WebSocket API for AI Interview OS
 */

import { Router, type Request, type Response } from 'express';
import { interviewOrchestrator, type CreateSessionInput, type AudioChunkInput } from '../../ai/interview/orchestrator';
import { redis } from '../../ai/shared/memory/redis';
import type { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * POST /api/v2/interview/sessions
 * Create a new interview session
 */
router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, positionId, competencies, questions, durationMinutes } = req.body;

    if (!candidateId || !positionId) {
      return res.status(400).json({ code: 'INT_001', message: 'candidateId and positionId are required' });
    }

    const input: CreateSessionInput = {
      tenantId: req.user?.tenantId || '',
      candidateId,
      positionId,
      interviewerId: req.user?.userId || '',
      competencies: competencies || ['Leadership', 'Communication', 'Ownership', 'Execution', 'Stress Resistance'],
      questions: questions || [],
      durationMinutes: durationMinutes || 45,
    };

    const session = await interviewOrchestrator.createSession(input);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ code: 'INT_500', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/interview/sessions/:sessionId/start
 * Start an interview session
 */
router.post('/sessions/:sessionId/start', async (req: Request, res: Response) => {
  try {
    await interviewOrchestrator.startSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ code: 'INT_502', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/interview/sessions/:sessionId/pause
 */
router.post('/sessions/:sessionId/pause', async (req: Request, res: Response) => {
  try {
    await interviewOrchestrator.pauseSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ code: 'INT_503', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/interview/sessions/:sessionId/resume
 */
router.post('/sessions/:sessionId/resume', async (req: Request, res: Response) => {
  try {
    await interviewOrchestrator.resumeSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ code: 'INT_504', message: (error as Error).message });
  }
});

/**
 * POST /api/v2/interview/sessions/:sessionId/end
 * End session and trigger report generation
 */
router.post('/sessions/:sessionId/end', async (req: Request, res: Response) => {
  try {
    await interviewOrchestrator.endSession(req.params.sessionId);
    res.json({ success: true, message: 'Session ended, report generation triggered' });
  } catch (error) {
    res.status(500).json({ code: 'INT_505', message: (error as Error).message });
  }
});

/**
 * GET /api/v2/interview/sessions/:sessionId
 * Get full session state
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const state = await interviewOrchestrator.getSessionState(req.params.sessionId);
    if (!state) {
      return res.status(404).json({ code: 'INT_404', message: 'Session not found' });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ code: 'INT_506', message: (error as Error).message });
  }
});

// ─── Audio Processing ────────────────────────────────────────────────────────

/**
 * POST /api/v2/interview/sessions/:sessionId/audio
 * Submit audio chunk for transcription
 */
router.post('/sessions/:sessionId/audio', async (req: Request, res: Response) => {
  try {
    const { audioUrl, format, chunkIndex } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ code: 'INT_010', message: 'audioUrl is required' });
    }

    const input: AudioChunkInput = {
      sessionId: req.params.sessionId,
      audioUrl,
      format: format || 'webm',
      chunkIndex: chunkIndex || 0,
    };

    await interviewOrchestrator.processAudioChunk(input);
    res.json({ success: true, message: 'Audio chunk queued for transcription' });
  } catch (error) {
    res.status(500).json({ code: 'INT_511', message: (error as Error).message });
  }
});

// ─── Question Management ─────────────────────────────────────────────────────

/**
 * POST /api/v2/interview/sessions/:sessionId/next-question
 * Advance to next question
 */
router.post('/sessions/:sessionId/next-question', async (req: Request, res: Response) => {
  try {
    const question = await interviewOrchestrator.advanceQuestion(req.params.sessionId);
    if (!question) {
      return res.json({ success: true, data: null, message: 'No more questions' });
    }
    res.json({ success: true, data: question });
  } catch (error) {
    res.status(500).json({ code: 'INT_520', message: (error as Error).message });
  }
});

/**
 * GET /api/v2/interview/sessions/:sessionId/current-question
 */
router.get('/sessions/:sessionId/current-question', async (req: Request, res: Response) => {
  try {
    const question = await interviewOrchestrator.getCurrentQuestion(req.params.sessionId);
    res.json({ success: true, data: question });
  } catch (error) {
    res.status(500).json({ code: 'INT_521', message: (error as Error).message });
  }
});

// ─── Transcript ──────────────────────────────────────────────────────────────

/**
 * GET /api/v2/interview/sessions/:sessionId/transcript
 * Get full transcript
 */
router.get('/sessions/:sessionId/transcript', async (req: Request, res: Response) => {
  try {
    const transcript = await redis.getTranscript(req.params.sessionId);
    res.json({ success: true, data: transcript });
  } catch (error) {
    res.status(500).json({ code: 'INT_530', message: (error as Error).message });
  }
});

// ─── Scores ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/interview/sessions/:sessionId/scores
 * Get real-time scores
 */
router.get('/sessions/:sessionId/scores', async (req: Request, res: Response) => {
  try {
    const scores = await redis.getScores(req.params.sessionId);
    res.json({ success: true, data: scores });
  } catch (error) {
    res.status(500).json({ code: 'INT_540', message: (error as Error).message });
  }
});

// ─── SSE Stream ──────────────────────────────────────────────────────────────

/**
 * GET /api/v2/interview/sessions/:sessionId/stream
 * Server-Sent Events stream for real-time updates
 */
router.get('/sessions/:sessionId/stream', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

  // Subscribe to events for this session
  const { eventBus } = require('../../ai/shared/events/bus');
  const events = [
    'interview:transcript',
    'interview:score_update',
    'interview:followup',
    'interview:star_detected',
    'interview:competency_signal',
    'interview:timer_update',
    'interview:completed',
  ];

  const unsubscribers: Array<() => void> = [];

  for (const eventType of events) {
    const unsub = eventBus.subscribe(eventType, (payload: unknown) => {
      const p = payload as { sessionId?: string };
      if (p.sessionId === sessionId) {
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
      }
    });
    unsubscribers.push(unsub);
  }

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribers.forEach(unsub => unsub());
  });
});

export default router;
