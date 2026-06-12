/**
 * Trust Layer 类型定义
 * 信任可信底座核心接口与数据结构
 */

/** CA认证结果 */
export interface CAAuthResult {
  verified: boolean;
  enterpriseId: string;
  enterpriseName: string;
  certLevel: 'EV' | 'OV' | 'DV';
  validUntil: string;
  sm3Hash: string;
  scopedToken: string;
}

/** CA认证请求 */
export interface CAAuthRequest {
  certSerialNo: string;
  signedChallenge: string;
  timestamp: number;
  deviceFingerprint: string;
}

/** 企业认证状态 */
export interface EnterpriseVerification {
  enterpriseId: string;
  enterpriseName: string;
  verified: boolean;
  certLevel: 'EV' | 'OV' | 'DV';
  verifiedAt: string;
  expiresAt: string;
  trustScore: number;
}

/** 操作存证记录 */
export interface EvidenceRecord {
  id: string;
  operatorCertSerial: string;
  operationType: 'decision_approve' | 'job_publish' | 'interview_score' | 'endorsement_issue';
  content: string;
  timestamp: number;
  sm3Hash: string;
  caSignature?: string;
}

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceType: 'candidate' | 'position' | 'decision' | 'system' | 'auth';
  result: 'success' | 'denied' | 'warning';
  ip: string;
  sm3Hash: string;
  details: string;
  tenantId: string;
}

/** ScopedToken载荷 */
export interface ScopedTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  certSerial: string;
}

/** CA适配器接口 */
export interface ICAAdapter {
  authenticate(request: CAAuthRequest): Promise<CAAuthResult>;
  verifyEnterprise(enterpriseId: string): Promise<EnterpriseVerification>;
  storeEvidence(record: Omit<EvidenceRecord, 'id' | 'sm3Hash'>): Promise<EvidenceRecord>;
  revokeToken(token: string): Promise<void>;
}

/** k-匿名聚合校验 */
export interface AggregationGuard {
  /** 最小样本量，低于此值拒绝聚合 */
  minK: number;
  /** 校验聚合请求是否满足k-匿名要求 */
  validate(sampleSize: number): boolean;
  /** 对聚合结果进行脱敏处理 */
  sanitize<T>(data: T[], fields: string[]): T[];
}

/** 租户隔离上下文 */
export interface TenantContext {
  tenantId: string;
  enterpriseName: string;
  certLevel: 'EV' | 'OV' | 'DV';
  permissions: string[];
}
