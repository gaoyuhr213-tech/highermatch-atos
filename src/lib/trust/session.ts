/**
 * useTrustedSession — 全局信任会话钩子
 * PRD §9: 信任调用链
 * 
 * 入场流完成身份注入，全局可读。
 * Demo注入mock身份，生产切换只换Adapter。
 * 
 * 严格区分：
 * - 签名主体（企业U盾SM2）= enterprise
 * - 操作人（使用人）= operator
 */

import { createContext, useContext } from 'react';

export interface TrustedIdentity {
  /** 企业名称（签名主体） */
  enterprise: string;
  /** 统一社会信用代码 */
  unifiedCreditCode: string;
  /** 证书等级 EV/OV/DV */
  certLevel: 'EV' | 'OV' | 'DV';
  /** 证书序列号 */
  certSerial: string;
  /** CA签发机构 */
  caIssuer: string;
  /** 操作人姓名+职务 */
  operator: string;
  /** 操作人席位授权ID */
  operatorSeatId: string;
  /** ScopedToken（会话级） */
  scopedToken: string;
  /** 会话建立时间 */
  sessionEstablishedAt: string;
  /** 会话过期时间 */
  sessionExpiresAt: string;
}

export interface TrustedSessionContextValue {
  /** 当前信任身份（null=未认证） */
  identity: TrustedIdentity | null;
  /** 是否已通过可信入场 */
  isAuthenticated: boolean;
  /** 注入身份（入场流调用） */
  setIdentity: (identity: TrustedIdentity) => void;
  /** 清除身份（退出/过期） */
  clearIdentity: () => void;
  /** 获取签名主体展示文本 */
  getSignerDisplay: () => string;
  /** 获取操作人展示文本 */
  getOperatorDisplay: () => string;
}

/** Demo默认身份 — PRD §9 mock身份 */
export const DEMO_IDENTITY: TrustedIdentity = {
  enterprise: '蜀道集团',
  unifiedCreditCode: '91510000MA62K3YB2X',
  certLevel: 'EV',
  certSerial: 'SCCA-EV-2024-3A7F',
  caIssuer: '四川省数字证书认证管理中心',
  operator: '张某·财务总监',
  operatorSeatId: 'SEAT-CFO-001',
  scopedToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJTTTIifQ.demo_scoped_token',
  sessionEstablishedAt: new Date().toISOString(),
  sessionExpiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
};

export const TrustedSessionContext = createContext<TrustedSessionContextValue>({
  identity: null,
  isAuthenticated: false,
  setIdentity: () => {},
  clearIdentity: () => {},
  getSignerDisplay: () => '',
  getOperatorDisplay: () => '',
});

export function useTrustedSession(): TrustedSessionContextValue {
  return useContext(TrustedSessionContext);
}
