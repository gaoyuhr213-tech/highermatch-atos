/**
 * 蓉才通™ ATOS — API v2 Router Registry
 * 
 * Mounts all AI module routes under /api/v2/
 */

import { Router } from 'express';
import interviewRouter from './interview';
import resumeRouter from './resume';
import peopleRouter from './people';
import copilotRouter from './copilot';

const v2Router = Router();

v2Router.use('/interview', interviewRouter);
v2Router.use('/resume', resumeRouter);
v2Router.use('/people', peopleRouter);
v2Router.use('/copilot', copilotRouter);

// Health check
v2Router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    modules: ['interview', 'resume', 'people', 'copilot'],
    timestamp: new Date().toISOString(),
  });
});

export default v2Router;
