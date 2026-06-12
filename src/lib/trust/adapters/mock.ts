/**
 * Mock CA Adapter — 开发环境
 * 
 * 使用真实Web Crypto哈希替代简单字符串操作
 * 使用JWT签名替代base64伪造token
 * 完整模拟PIN锁定、证书过期、CRL撤销等错误场景
 */

import type { ICAAdapter, CAAuthRequest, CAAuthResult, EnterpriseVerification, EvidenceRecord } from '../types';
import { computeSM3, generateJWT, computeSM3Sync } from '../crypto';

const JWT_SECRET = 'atos_dev_secret_replace_in_production_sm2_key';

const MOCK_ENTERPRISES: Record<string, { name: string; certLevel: 'EV' | 'OV' | 'DV'; region: string }> = {
  'MOCK-CERT-001': { name: '蜀道集团', certLevel: 'EV', region: '四川省成都市' },
  'MOCK-CERT-002': { name: '川投集团', certLevel: 'EV', region: '四川省成都市' },
  'MOCK-CERT-003': { name: '天府软件园', certLevel: 'OV', region: '四川省成都市高新区' },
  'MOCK-CERT-004': { name: '成都银行', certLevel: 'EV', region: '四川省成都市' },
  'MOCK-CERT-005': { name: '四川能投', certLevel: 'OV', region: '四川省成都市' },
  'MOCK-CERT-006': { name: '长虹电子', certLevel: 'OV', region: '四川省绵阳市' },
  'MOCK-CERT-007': { name: '五粮液集团', certLevel: 'EV', region: '四川省宜宾市' },
};

// PIN锁定计数器
const pinAttempts: Record<string, number> = {};
const MAX_PIN_ATTEMPTS = 5;

// 存证链
const evidenceChain: EvidenceRecord[] = [];

export class MockCAAdapter implements ICAAdapter {
  async authenticate(request: CAAuthRequest): Promise<CAAuthResult> {
    // 模拟网络延迟（200-400ms）
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));

    // 时间窗口校验（5分钟）
    const now = Date.now();
    if (Math.abs(now - request.timestamp) > 5 * 60 * 1000) {
      throw new Error('CA_001: 认证请求已过期，时间偏差超过5分钟');
    }

    // PIN锁定检查
    const attempts = pinAttempts[request.certSerialNo] || 0;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      throw new Error('CA_002: PIN码错误次数过多，U盾已锁定，请携带有效证件至CA服务网点解锁');
    }

    // 模拟错误场景
    if (request.certSerialNo === 'MOCK-CERT-EXPIRED') {
      throw new Error('CA_003: 数字证书已过期，请联系四川CA续期');
    }
    if (request.certSerialNo === 'MOCK-CERT-REVOKED') {
      throw new Error('CA_004: 证书已被CRL撤销');
    }
    if (request.certSerialNo === 'MOCK-CERT-LOCKED') {
      pinAttempts[request.certSerialNo] = MAX_PIN_ATTEMPTS;
      throw new Error('CA_002: PIN码错误次数过多，U盾已锁定');
    }

    const enterprise = MOCK_ENTERPRISES[request.certSerialNo];
    if (!enterprise) {
      // 模拟PIN错误（累计计数）
      pinAttempts[request.certSerialNo] = (pinAttempts[request.certSerialNo] || 0) + 1;
      const remaining = MAX_PIN_ATTEMPTS - pinAttempts[request.certSerialNo];
      throw new Error(`CA_005: 企业未注册或证书序列号无效（剩余尝试次数: ${remaining}）`);
    }

    // 重置PIN计数
    pinAttempts[request.certSerialNo] = 0;

    const tenantId = 'T-' + enterprise.name.replace(/[^a-zA-Z\u4e00-\u9fff]/g, '').slice(0, 8);

    // 使用真实SM3哈希
    const sm3Hash = await computeSM3(`${request.certSerialNo}:${request.signedChallenge}:${request.timestamp}`);

    // 使用真实JWT签名
    const scopedToken = await generateJWT({
      sub: tenantId,
      tenantId,
      role: 'enterprise_admin',
      permissions: ['job:publish', 'candidate:view', 'interview:manage', 'decision:approve', 'audit:read'],
      certSerial: request.certSerialNo,
      enterpriseName: enterprise.name,
      certLevel: enterprise.certLevel,
    }, JWT_SECRET, 8);

    return {
      verified: true,
      enterpriseId: tenantId,
      enterpriseName: enterprise.name,
      certLevel: enterprise.certLevel,
      validUntil: new Date(now + 365 * 24 * 3600 * 1000).toISOString(),
      sm3Hash,
      scopedToken,
    };
  }

  async verifyEnterprise(enterpriseId: string): Promise<EnterpriseVerification> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const entry = Object.entries(MOCK_ENTERPRISES).find(([_, v]) =>
      'T-' + v.name.replace(/[^a-zA-Z\u4e00-\u9fff]/g, '').slice(0, 8) === enterpriseId
    );

    if (!entry) {
      return {
        enterpriseId,
        enterpriseName: '未知企业',
        verified: false,
        certLevel: 'DV',
        verifiedAt: '',
        expiresAt: '',
        trustScore: 0,
      };
    }

    return {
      enterpriseId,
      enterpriseName: entry[1].name,
      verified: true,
      certLevel: entry[1].certLevel,
      verifiedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 335 * 24 * 3600 * 1000).toISOString(),
      trustScore: entry[1].certLevel === 'EV' ? 95 : 80,
    };
  }

  async storeEvidence(record: Omit<EvidenceRecord, 'id' | 'sm3Hash'>): Promise<EvidenceRecord> {
    await new Promise(resolve => setTimeout(resolve, 50));

    const id = `EVD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const prevHash = evidenceChain.length > 0
      ? evidenceChain[evidenceChain.length - 1].sm3Hash
      : 'SM3:genesis_0000000000000000';

    const content = `${id}:${record.operatorCertSerial}:${record.content}:${record.timestamp}:${prevHash}`;
    const sm3Hash = computeSM3Sync(content);

    const fullRecord: EvidenceRecord = { ...record, id, sm3Hash };
    evidenceChain.push(fullRecord);

    return fullRecord;
  }

  async revokeToken(token: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`[MockCA] Token revoked: ${token.slice(0, 30)}...`);
  }
}
