import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; tenantId: string; role: string; permissions: string[]; certSerial: string; };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'AUTH_001', message: '缺少认证令牌' });
  }
  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(401).json({ code: 'AUTH_002', message: '令牌格式无效' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ code: 'AUTH_003', message: '令牌已过期' });
    }
    req.user = { sub: payload.sub, tenantId: payload.tenantId, role: payload.role, permissions: payload.permissions || [], certSerial: payload.certSerial };
    next();
  } catch { return res.status(401).json({ code: 'AUTH_004', message: '令牌验证失败' }); }
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ code: 'AUTH_001', message: '未认证' });
    const has = permissions.every(p => req.user!.permissions.includes(p));
    if (!has) return res.status(403).json({ code: 'AUTH_005', message: '权限不足', required: permissions });
    next();
  };
}
