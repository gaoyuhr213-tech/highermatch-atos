/**
 * 四川CA政务网关生产适配器 (SCCA Adapter)
 * 
 * 前置条件：
 * 1. npm install @scca/gm-crypto @scca/ushield-driver
 * 2. 环境变量: VITE_CA_GATEWAY_URL, VITE_CA_APP_ID, VITE_CA_APP_SECRET
 * 3. 部署SSL证书（双向mTLS）
 */

import type { ICAAdapter, CAAuthRequest, CAAuthResult, EnterpriseVerification, EvidenceRecord } from '../types';

interface SCCAConfig {
  gatewayUrl: string;
  appId: string;
  appSecret: string;
  timeout?: number;
  retryCount?: number;
}

export class SCCAAdapter implements ICAAdapter {
  private config: SCCAConfig;

  constructor(config: SCCAConfig) {
    this.config = config;
    if (!config.gatewayUrl || !config.appId || !config.appSecret) {
      throw new Error('[SCCAAdapter] 缺少必要配置参数');
    }
  }

  async authenticate(request: CAAuthRequest): Promise<CAAuthResult> {
    const url = `${this.config.gatewayUrl}/api/v1/cert/verify`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': this.config.appId,
        'X-App-Secret': this.config.appSecret,
        'X-Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: 'UNKNOWN', message: '网关异常' }));
      throw new Error(`CA_${error.code}: ${error.message}`);
    }
    return await response.json();
  }

  async verifyEnterprise(enterpriseId: string): Promise<EnterpriseVerification> {
    const url = `${this.config.gatewayUrl}/api/v1/enterprise/${enterpriseId}/status`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: { 'X-App-Id': this.config.appId, 'X-App-Secret': this.config.appSecret },
    });
    if (!response.ok) throw new Error(`查询企业状态失败: HTTP ${response.status}`);
    return await response.json();
  }

  async storeEvidence(record: Omit<EvidenceRecord, 'id' | 'sm3Hash'>): Promise<EvidenceRecord> {
    const url = `${this.config.gatewayUrl}/api/v1/evidence/store`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': this.config.appId, 'X-App-Secret': this.config.appSecret },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error(`存证写入失败: HTTP ${response.status}`);
    return await response.json();
  }

  async revokeToken(token: string): Promise<void> {
    const url = `${this.config.gatewayUrl}/api/v1/token/revoke`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': this.config.appId, 'X-App-Secret': this.config.appSecret },
      body: JSON.stringify({ token }),
    });
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    const timeout = this.config.timeout || 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt < (this.config.retryCount || 3)) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw new Error(`CA网关连接失败（重试${attempt}次）: ${error}`);
    }
  }
}
