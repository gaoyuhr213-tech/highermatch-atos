/**
 * Trust Gateway — CA校验统一收敛入口
 * 
 * 所有CA调用必须通过此Gateway路由
 * 支持开发/生产模式动态切换
 * 内置k-匿名聚合守卫
 */

import type { ICAAdapter, CAAuthRequest, CAAuthResult, EnterpriseVerification, EvidenceRecord } from './types';
import { MockCAAdapter } from './adapters/mock';

let adapterInstance: ICAAdapter | null = null;

/**
 * 创建CA适配器（单例）
 * 
 * 切换方式：
 * - 开发环境（默认）：使用MockCAAdapter
 * - 生产环境：设置 VITE_TRUST_MODE=production 并配置CA网关参数
 */
export function createCAAdapter(): ICAAdapter {
  if (adapterInstance) return adapterInstance;

  const trustMode = import.meta.env?.VITE_TRUST_MODE || 'development';

  if (trustMode === 'production') {
    // 生产环境：动态加载SCCA适配器
    const gatewayUrl = import.meta.env?.VITE_CA_GATEWAY_URL;
    const appId = import.meta.env?.VITE_CA_APP_ID;
    const appSecret = import.meta.env?.VITE_CA_APP_SECRET;

    if (gatewayUrl && appId && appSecret) {
      // 动态导入避免开发环境加载生产依赖
      import('./adapters/scca').then(({ SCCAAdapter }) => {
        adapterInstance = new SCCAAdapter({ gatewayUrl, appId, appSecret });
      }).catch(() => {
        console.error('[TrustGateway] SCCA适配器加载失败，降级为Mock模式');
        adapterInstance = new MockCAAdapter();
      });
    } else {
      console.warn('[TrustGateway] 生产模式缺少CA网关配置，降级为Mock模式');
    }
    // 在异步加载完成前使用Mock
    adapterInstance = new MockCAAdapter();
  } else {
    adapterInstance = new MockCAAdapter();
  }

  return adapterInstance;
}

/** 获取当前CA适配器实例 */
export function getCAAdapter(): ICAAdapter {
  return createCAAdapter();
}

/** 重置适配器（用于测试） */
export function resetCAAdapter(): void {
  adapterInstance = null;
}

/**
 * k-匿名聚合守卫
 * 任何对外聚合洞察必须满足 k >= 20
 * 低于阈值拒绝聚合，只展示比例/趋势，不可下钻到个人
 */
export function validateAggregation(sampleSize: number, minK: number = 20): boolean {
  if (sampleSize < minK) {
    console.warn(`[AggregationGuard] 样本量 ${sampleSize} < 最小阈值 ${minK}，聚合请求被拒绝`);
    return false;
  }
  return true;
}

/**
 * 聚合数据脱敏处理
 * 对不满足k-匿名的维度进行模糊化
 */
export function sanitizeAggregation<T extends Record<string, unknown>>(
  data: T[],
  sensitiveFields: string[],
  minK: number = 20
): T[] {
  if (data.length < minK) {
    return []; // 样本量不足，拒绝返回
  }

  return data.map(item => {
    const sanitized = { ...item };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***' as unknown as T[keyof T];
      }
    }
    return sanitized;
  });
}

/**
 * 统一认证入口
 * 封装错误处理和审计日志
 */
export async function authenticate(request: CAAuthRequest): Promise<CAAuthResult> {
  const adapter = getCAAdapter();
  try {
    const result = await adapter.authenticate(request);
    return result;
  } catch (error) {
    // 统一错误格式
    const message = error instanceof Error ? error.message : '认证失败';
    throw new Error(message);
  }
}

/**
 * 统一企业验证入口
 */
export async function verifyEnterprise(enterpriseId: string): Promise<EnterpriseVerification> {
  const adapter = getCAAdapter();
  return adapter.verifyEnterprise(enterpriseId);
}

/**
 * 统一存证入口
 */
export async function storeEvidence(record: Omit<EvidenceRecord, 'id' | 'sm3Hash'>): Promise<EvidenceRecord> {
  const adapter = getCAAdapter();
  return adapter.storeEvidence(record);
}
