import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

export function tenantIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) {
    return res.status(403).json({ code: 'TENANT_001', message: '租户上下文缺失' });
  }
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId && headerTenantId !== req.user.tenantId) {
    return res.status(403).json({ code: 'TENANT_002', message: '租户ID不匹配，禁止越权访问' });
  }
  res.setHeader('X-Tenant-Id', req.user.tenantId);
  next();
}
