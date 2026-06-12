import type { Request, Response, NextFunction } from 'express';

const windowMs = 60 * 1000;
const maxRequests = 100;
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000).toString());
    return res.status(429).json({ code: 'RATE_LIMIT', message: '请求过于频繁' });
  }
  next();
}
