import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[Error] ${err.name}: ${err.message}`);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isDev ? err.message : '服务器内部错误',
    ...(isDev && { stack: err.stack }),
  });
}
