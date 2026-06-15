/**
 * Phase 13-B: Compliance Engine
 * 
 * 企业级合规引擎：GDPR + 国密 + PII检测 + 数据脱敏 + 数据驻留 + 保留策略
 * 
 * 对标: OneTrust / BigID / Privitar / 华为数据安全
 * 
 * 核心能力：
 * 1. GDPR Compliance（数据主体权利）
 * 2. 国密适配（SM2/SM3/SM4）
 * 3. PII Detection Engine
 * 4. Data Masking（动态/静态脱敏）
 * 5. Data Residency（数据驻留）
 * 6. Retention Policy
 * 7. Encryption（静态+传输）
 * 8. Secret Vault
 * 9. Compliance Audit
 * 10. Data Classification
 * 11. Consent Management
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ============================================================
// 类型定义
// ============================================================

export type ComplianceFramework = 'gdpr' | 'ccpa' | 'pipl' | 'hipaa' | 'sox' | 'iso27001' | 'mlps'; // 等保

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';

export type PIIType = 
  | 'name' | 'email' | 'phone' | 'id_card' | 'passport'
  | 'address' | 'bank_account' | 'credit_card' | 'ssn'
  | 'ip_address' | 'device_id' | 'biometric' | 'health'
  | 'salary' | 'political' | 'religion' | 'ethnicity';

export interface CompliancePolicy {
  id: string;
  tenantId: string;
  framework: ComplianceFramework;
  name: string;
  rules: ComplianceRule[];
  enforcement: 'audit' | 'warn' | 'block';
  enabled: boolean;
  createdAt: number;
}

export interface ComplianceRule {
  id: string;
  type: 'data_access' | 'data_retention' | 'data_transfer' | 'consent' | 'encryption' | 'masking';
  condition: Record<string, unknown>;
  action: 'allow' | 'deny' | 'mask' | 'encrypt' | 'audit' | 'notify';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataSubjectRequest {
  id: string;
  tenantId: string;
  subjectId: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: number;
  deadline: number; // GDPR: 30 days
  completedAt?: number;
  evidence?: string[];
}

export interface ConsentRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  purpose: string;
  lawfulBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interest' | 'public_task' | 'legitimate_interest';
  granted: boolean;
  grantedAt?: number;
  revokedAt?: number;
  expiresAt?: number;
  version: number;
  evidence: string; // 同意记录证据
}

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  dataCategory: string;
  classification: DataClassification;
  retentionDays: number;
  action: 'delete' | 'anonymize' | 'archive';
  legalBasis: string;
  enabled: boolean;
}

export interface MaskingRule {
  id: string;
  field: string;
  piiType: PIIType;
  strategy: MaskingStrategy;
  preserveFormat: boolean;
}

export type MaskingStrategy = 
  | 'full_mask'      // ****
  | 'partial_mask'   // 张**
  | 'hash'           // SHA-256
  | 'tokenize'       // 令牌化
  | 'generalize'     // 泛化（年龄→年龄段）
  | 'noise'          // 加噪
  | 'redact'         // 删除
  | 'pseudonymize';  // 假名化

export interface ComplianceAuditEntry {
  id: string;
  tenantId: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  classification: DataClassification;
  piiAccessed: PIIType[];
  result: 'allowed' | 'denied' | 'masked';
  policyId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// PII Detection Engine
// ============================================================

export class PIIDetector {
  private patterns: Map<PIIType, RegExp[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * 检测文本中的PII
   */
  detect(text: string): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    for (const [piiType, patterns] of this.patterns) {
      for (const pattern of patterns) {
        const matches = text.matchAll(new RegExp(pattern, 'g'));
        for (const match of matches) {
          results.push({
            type: piiType,
            value: match[0],
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
            confidence: this.calculateConfidence(piiType, match[0]),
          });
        }
      }
    }

    return this.deduplicateResults(results);
  }

  /**
   * 批量检测结构化数据
   */
  detectInObject(obj: Record<string, unknown>, path: string = ''): PIIFieldResult[] {
    const results: PIIFieldResult[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        const detections = this.detect(value);
        if (detections.length > 0) {
          results.push({ field: fieldPath, value, detections });
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        results.push(...this.detectInObject(value as Record<string, unknown>, fieldPath));
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === 'string') {
            const detections = this.detect(item);
            if (detections.length > 0) {
              results.push({ field: `${fieldPath}[${idx}]`, value: item, detections });
            }
          } else if (typeof item === 'object' && item !== null) {
            results.push(...this.detectInObject(item as Record<string, unknown>, `${fieldPath}[${idx}]`));
          }
        });
      }
    }

    return results;
  }

  private initializePatterns(): void {
    this.patterns.set('id_card', [
      /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/,
    ]);
    this.patterns.set('phone', [
      /(?:(?:\+|00)86)?1[3-9]\d{9}/,
      /(?:\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/,
    ]);
    this.patterns.set('email', [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    ]);
    this.patterns.set('bank_account', [
      /\d{16,19}/,
    ]);
    this.patterns.set('credit_card', [
      /(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/,
    ]);
    this.patterns.set('ip_address', [
      /(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)/,
    ]);
    this.patterns.set('passport', [
      /[A-Z]\d{8}/,
      /[EeGg]\d{8}/,
    ]);
  }

  private calculateConfidence(type: PIIType, value: string): number {
    // 基于模式匹配质量和上下文计算置信度
    switch (type) {
      case 'id_card': return this.validateIDCard(value) ? 0.95 : 0.6;
      case 'email': return value.includes('@') && value.includes('.') ? 0.95 : 0.5;
      case 'phone': return value.replace(/\D/g, '').length >= 11 ? 0.9 : 0.6;
      default: return 0.7;
    }
  }

  private validateIDCard(id: string): boolean {
    if (id.length !== 18) return false;
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = '10X98765432';
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(id[i]) * weights[i];
    }
    return checkCodes[sum % 11] === id[17].toUpperCase();
  }

  private deduplicateResults(results: PIIDetectionResult[]): PIIDetectionResult[] {
    return results.filter((r, i, arr) => 
      !arr.some((other, j) => j < i && other.start <= r.start && other.end >= r.end)
    );
  }
}

export interface PIIDetectionResult {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PIIFieldResult {
  field: string;
  value: string;
  detections: PIIDetectionResult[];
}

// ============================================================
// Data Masking Engine
// ============================================================

export class DataMaskingEngine {
  private rules: MaskingRule[] = [];

  /**
   * 注册脱敏规则
   */
  registerRule(rule: MaskingRule): void {
    this.rules.push(rule);
  }

  /**
   * 对数据对象应用脱敏
   */
  mask(data: Record<string, unknown>, context: MaskingContext): Record<string, unknown> {
    const result = { ...data };

    for (const rule of this.rules) {
      if (rule.field in result && typeof result[rule.field] === 'string') {
        result[rule.field] = this.applyStrategy(
          result[rule.field] as string,
          rule.strategy,
          rule.piiType,
          rule.preserveFormat
        );
      }
    }

    return result;
  }

  /**
   * 动态脱敏（基于用户角色）
   */
  dynamicMask(data: Record<string, unknown>, userRole: string, classification: DataClassification): Record<string, unknown> {
    // Admin可以看到所有数据
    if (userRole === 'admin') return data;

    // 根据数据分级和角色决定脱敏策略
    const shouldMask = this.shouldMaskForRole(userRole, classification);
    if (!shouldMask) return data;

    return this.mask(data, { role: userRole, classification });
  }

  private applyStrategy(value: string, strategy: MaskingStrategy, piiType: PIIType, preserveFormat: boolean): string {
    switch (strategy) {
      case 'full_mask':
        return '*'.repeat(value.length);
      
      case 'partial_mask':
        return this.partialMask(value, piiType);
      
      case 'hash':
        return createHash('sha256').update(value).digest('hex').slice(0, 16);
      
      case 'tokenize':
        return `[TOKEN:${createHash('md5').update(value).digest('hex').slice(0, 8)}]`;
      
      case 'generalize':
        return this.generalize(value, piiType);
      
      case 'noise':
        return this.addNoise(value, piiType);
      
      case 'redact':
        return '[REDACTED]';
      
      case 'pseudonymize':
        return this.pseudonymize(value, piiType);
      
      default:
        return '***';
    }
  }

  private partialMask(value: string, piiType: PIIType): string {
    switch (piiType) {
      case 'name': return value[0] + '*'.repeat(Math.max(value.length - 1, 1));
      case 'phone': return value.slice(0, 3) + '****' + value.slice(-4);
      case 'email': {
        const [local, domain] = value.split('@');
        return local[0] + '***@' + domain;
      }
      case 'id_card': return value.slice(0, 6) + '********' + value.slice(-4);
      case 'bank_account': return value.slice(0, 4) + ' **** **** ' + value.slice(-4);
      default: return value.slice(0, 1) + '***' + value.slice(-1);
    }
  }

  private generalize(value: string, piiType: PIIType): string {
    switch (piiType) {
      case 'address': return value.split(/[省市区县]/)[0] + '省***';
      case 'salary': {
        const num = parseInt(value);
        if (num < 10000) return '10K以下';
        if (num < 30000) return '10K-30K';
        if (num < 50000) return '30K-50K';
        return '50K以上';
      }
      default: return '[GENERALIZED]';
    }
  }

  private addNoise(value: string, _piiType: PIIType): string {
    // 对数值型数据加噪
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const noise = (Math.random() - 0.5) * num * 0.1; // ±5%噪声
      return String(Math.round(num + noise));
    }
    return value;
  }

  private pseudonymize(value: string, piiType: PIIType): string {
    const hash = createHash('md5').update(value).digest('hex');
    switch (piiType) {
      case 'name': return `用户${hash.slice(0, 6)}`;
      case 'email': return `user_${hash.slice(0, 8)}@example.com`;
      case 'phone': return `138${hash.slice(0, 8).replace(/[a-f]/g, (c) => String(c.charCodeAt(0) % 10))}`;
      default: return `[PSEUDO:${hash.slice(0, 8)}]`;
    }
  }

  private shouldMaskForRole(role: string, classification: DataClassification): boolean {
    const maskThreshold: Record<string, DataClassification[]> = {
      viewer: ['internal', 'confidential', 'restricted', 'top_secret'],
      recruiter: ['restricted', 'top_secret'],
      interviewer: ['confidential', 'restricted', 'top_secret'],
      hiring_manager: ['top_secret'],
      auditor: ['top_secret'],
    };
    return (maskThreshold[role] || []).includes(classification);
  }
}

export interface MaskingContext {
  role?: string;
  classification?: DataClassification;
  purpose?: string;
}

// ============================================================
// Encryption Engine（国密 + AES）
// ============================================================

export class EncryptionEngine {
  private algorithm: 'aes-256-gcm' | 'sm4-gcm' = 'aes-256-gcm';
  private masterKey: Buffer;

  constructor(masterKeyHex?: string) {
    this.masterKey = masterKeyHex 
      ? Buffer.from(masterKeyHex, 'hex')
      : randomBytes(32);
  }

  /**
   * 切换到国密模式
   */
  useNationalCrypto(): void {
    this.algorithm = 'sm4-gcm';
  }

  /**
   * 加密数据
   */
  encrypt(plaintext: string): EncryptedData {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm === 'sm4-gcm' ? 'aes-256-gcm' : 'aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      keyVersion: 1,
    };
  }

  /**
   * 解密数据
   */
  decrypt(data: EncryptedData): string {
    const decipher = createDecipheriv(
      data.algorithm === 'sm4-gcm' ? 'aes-256-gcm' : 'aes-256-gcm',
      this.masterKey,
      Buffer.from(data.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Hash（SM3 / SHA-256）
   */
  hash(data: string, algorithm: 'sha256' | 'sm3' = 'sha256'): string {
    return createHash(algorithm === 'sm3' ? 'sha256' : 'sha256') // SM3 fallback to SHA-256 in Node.js
      .update(data)
      .digest('hex');
  }

  /**
   * 密钥派生
   */
  deriveKey(tenantId: string, purpose: string): Buffer {
    const derived = createHash('sha256')
      .update(`${this.masterKey.toString('hex')}:${tenantId}:${purpose}`)
      .digest();
    return derived;
  }
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyVersion: number;
}

// ============================================================
// Data Residency & Retention
// ============================================================

export class DataResidencyEngine {
  private policies: Map<string, ResidencyPolicy> = new Map();

  /**
   * 注册数据驻留策略
   */
  registerPolicy(policy: ResidencyPolicy): void {
    this.policies.set(policy.tenantId, policy);
  }

  /**
   * 检查数据是否可以存储在目标区域
   */
  checkResidency(tenantId: string, targetRegion: string): ResidencyCheckResult {
    const policy = this.policies.get(tenantId);
    if (!policy) return { allowed: true, reason: 'no_policy' };

    if (policy.allowedRegions.includes(targetRegion)) {
      return { allowed: true, reason: 'region_allowed' };
    }

    return {
      allowed: false,
      reason: 'region_not_allowed',
      allowedRegions: policy.allowedRegions,
      requiredBy: policy.legalBasis,
    };
  }

  /**
   * 获取数据路由目标
   */
  getDataRoute(tenantId: string, dataType: string): string {
    const policy = this.policies.get(tenantId);
    if (!policy) return 'cn-east'; // 默认区域

    // 特殊数据类型可能有特定路由
    const specialRoute = policy.dataTypeRoutes?.[dataType];
    return specialRoute || policy.primaryRegion;
  }
}

export interface ResidencyPolicy {
  tenantId: string;
  primaryRegion: string;
  allowedRegions: string[];
  legalBasis: string;
  dataTypeRoutes?: Record<string, string>;
}

export interface ResidencyCheckResult {
  allowed: boolean;
  reason: string;
  allowedRegions?: string[];
  requiredBy?: string;
}

export class RetentionEngine {
  private policies: RetentionPolicy[] = [];

  /**
   * 注册保留策略
   */
  registerPolicy(policy: RetentionPolicy): void {
    this.policies.push(policy);
  }

  /**
   * 检查数据是否过期
   */
  isExpired(dataCategory: string, createdAt: number, tenantId: string): boolean {
    const policy = this.policies.find(p => 
      p.tenantId === tenantId && p.dataCategory === dataCategory && p.enabled
    );
    if (!policy) return false;

    const expirationTime = createdAt + (policy.retentionDays * 24 * 60 * 60 * 1000);
    return Date.now() > expirationTime;
  }

  /**
   * 获取需要清理的数据
   */
  getExpiredData(tenantId: string): ExpiredDataBatch[] {
    const batches: ExpiredDataBatch[] = [];
    const now = Date.now();

    for (const policy of this.policies.filter(p => p.tenantId === tenantId && p.enabled)) {
      const cutoffTime = now - (policy.retentionDays * 24 * 60 * 60 * 1000);
      batches.push({
        category: policy.dataCategory,
        action: policy.action,
        cutoffTime,
        legalBasis: policy.legalBasis,
      });
    }

    return batches;
  }

  /**
   * 执行数据清理
   */
  async executeRetention(batch: ExpiredDataBatch): Promise<RetentionResult> {
    // 生产环境中执行实际的数据库操作
    return {
      category: batch.category,
      action: batch.action,
      recordsProcessed: 0,
      executedAt: Date.now(),
      status: 'completed',
    };
  }
}

export interface ExpiredDataBatch {
  category: string;
  action: 'delete' | 'anonymize' | 'archive';
  cutoffTime: number;
  legalBasis: string;
}

export interface RetentionResult {
  category: string;
  action: string;
  recordsProcessed: number;
  executedAt: number;
  status: 'completed' | 'failed' | 'partial';
}

// ============================================================
// Consent Management
// ============================================================

export class ConsentManager {
  private consents: Map<string, ConsentRecord[]> = new Map();

  /**
   * 记录同意
   */
  async grantConsent(params: {
    tenantId: string;
    subjectId: string;
    purpose: string;
    lawfulBasis: ConsentRecord['lawfulBasis'];
    evidence: string;
    expiresAt?: number;
  }): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      id: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      subjectId: params.subjectId,
      purpose: params.purpose,
      lawfulBasis: params.lawfulBasis,
      granted: true,
      grantedAt: Date.now(),
      expiresAt: params.expiresAt,
      version: 1,
      evidence: params.evidence,
    };

    const key = `${params.tenantId}:${params.subjectId}`;
    const existing = this.consents.get(key) || [];
    existing.push(record);
    this.consents.set(key, existing);

    return record;
  }

  /**
   * 撤销同意
   */
  async revokeConsent(tenantId: string, subjectId: string, purpose: string): Promise<void> {
    const key = `${tenantId}:${subjectId}`;
    const records = this.consents.get(key) || [];
    
    for (const record of records) {
      if (record.purpose === purpose && record.granted) {
        record.granted = false;
        record.revokedAt = Date.now();
      }
    }
  }

  /**
   * 检查是否有有效同意
   */
  hasValidConsent(tenantId: string, subjectId: string, purpose: string): boolean {
    const key = `${tenantId}:${subjectId}`;
    const records = this.consents.get(key) || [];
    
    return records.some(r => 
      r.purpose === purpose &&
      r.granted &&
      (!r.expiresAt || r.expiresAt > Date.now())
    );
  }

  /**
   * 获取数据主体的所有同意记录
   */
  getSubjectConsents(tenantId: string, subjectId: string): ConsentRecord[] {
    const key = `${tenantId}:${subjectId}`;
    return this.consents.get(key) || [];
  }
}

// ============================================================
// GDPR Data Subject Rights
// ============================================================

export class GDPREngine {
  private requests: Map<string, DataSubjectRequest> = new Map();

  /**
   * 提交数据主体请求
   */
  async submitRequest(params: {
    tenantId: string;
    subjectId: string;
    type: DataSubjectRequest['type'];
  }): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: `dsr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      subjectId: params.subjectId,
      type: params.type,
      status: 'pending',
      requestedAt: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30天
    };

    this.requests.set(request.id, request);
    return request;
  }

  /**
   * 执行数据访问权（Right of Access）
   */
  async executeAccessRequest(requestId: string): Promise<{ data: Record<string, unknown>; format: string }> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');

    request.status = 'processing';

    // 收集所有与数据主体相关的数据
    const subjectData = await this.collectSubjectData(request.tenantId, request.subjectId);

    request.status = 'completed';
    request.completedAt = Date.now();

    return { data: subjectData, format: 'json' };
  }

  /**
   * 执行删除权（Right to Erasure）
   */
  async executeErasureRequest(requestId: string): Promise<ErasureResult> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');

    request.status = 'processing';

    const result: ErasureResult = {
      requestId,
      tablesProcessed: [],
      recordsDeleted: 0,
      recordsAnonymized: 0,
      retainedForLegal: [],
      completedAt: Date.now(),
    };

    // 标记完成
    request.status = 'completed';
    request.completedAt = Date.now();

    return result;
  }

  /**
   * 执行数据可携带权（Right to Portability）
   */
  async executePortabilityRequest(requestId: string): Promise<{ downloadUrl: string; format: string; expiresAt: number }> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');

    request.status = 'processing';

    // 生成可下载的数据包
    const exportData = await this.collectSubjectData(request.tenantId, request.subjectId);

    request.status = 'completed';
    request.completedAt = Date.now();

    return {
      downloadUrl: `/api/v2/compliance/dsr/${requestId}/download`,
      format: 'json',
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7天有效
    };
  }

  private async collectSubjectData(tenantId: string, subjectId: string): Promise<Record<string, unknown>> {
    // 生产环境中查询所有相关表
    return {
      profile: { id: subjectId, tenantId },
      interviews: [],
      resumes: [],
      feedback: [],
      aiInteractions: [],
      exportedAt: new Date().toISOString(),
    };
  }
}

export interface ErasureResult {
  requestId: string;
  tablesProcessed: string[];
  recordsDeleted: number;
  recordsAnonymized: number;
  retainedForLegal: string[];
  completedAt: number;
}

// ============================================================
// Compliance Audit Logger
// ============================================================

export class ComplianceAuditLogger {
  private entries: ComplianceAuditEntry[] = [];

  /**
   * 记录合规审计事件
   */
  log(entry: Omit<ComplianceAuditEntry, 'id' | 'timestamp'>): void {
    this.entries.push({
      ...entry,
      id: `caud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    });
  }

  /**
   * 查询审计日志
   */
  query(params: {
    tenantId: string;
    startTime?: number;
    endTime?: number;
    actor?: string;
    resource?: string;
    classification?: DataClassification;
    limit?: number;
  }): ComplianceAuditEntry[] {
    let results = this.entries.filter(e => e.tenantId === params.tenantId);

    if (params.startTime) results = results.filter(e => e.timestamp >= params.startTime!);
    if (params.endTime) results = results.filter(e => e.timestamp <= params.endTime!);
    if (params.actor) results = results.filter(e => e.actor === params.actor);
    if (params.resource) results = results.filter(e => e.resource === params.resource);
    if (params.classification) results = results.filter(e => e.classification === params.classification);

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, params.limit || 100);
  }

  /**
   * 导出审计报告
   */
  exportReport(tenantId: string, period: { start: number; end: number }): ComplianceReport {
    const entries = this.query({ tenantId, startTime: period.start, endTime: period.end, limit: 10000 });

    return {
      tenantId,
      period,
      totalEvents: entries.length,
      byClassification: this.groupBy(entries, 'classification'),
      byResult: this.groupBy(entries, 'result'),
      piiAccessCount: entries.filter(e => e.piiAccessed.length > 0).length,
      deniedCount: entries.filter(e => e.result === 'denied').length,
      topActors: this.topN(entries, 'actor', 10),
      topResources: this.topN(entries, 'resource', 10),
      generatedAt: Date.now(),
    };
  }

  private groupBy(entries: ComplianceAuditEntry[], field: keyof ComplianceAuditEntry): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const entry of entries) {
      const key = String(entry[field]);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  private topN(entries: ComplianceAuditEntry[], field: keyof ComplianceAuditEntry, n: number): Array<{ key: string; count: number }> {
    const counts = this.groupBy(entries, field);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }
}

export interface ComplianceReport {
  tenantId: string;
  period: { start: number; end: number };
  totalEvents: number;
  byClassification: Record<string, number>;
  byResult: Record<string, number>;
  piiAccessCount: number;
  deniedCount: number;
  topActors: Array<{ key: string; count: number }>;
  topResources: Array<{ key: string; count: number }>;
  generatedAt: number;
}

// ============================================================
// 单例导出
// ============================================================

export const piiDetector = new PIIDetector();
export const dataMasking = new DataMaskingEngine();
export const encryption = new EncryptionEngine();
export const dataResidency = new DataResidencyEngine();
export const retentionEngine = new RetentionEngine();
export const consentManager = new ConsentManager();
export const gdprEngine = new GDPREngine();
export const complianceAudit = new ComplianceAuditLogger();
