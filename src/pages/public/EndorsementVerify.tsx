/**
 * 公开背书验真页 — PRD §8.5
 * 
 * /e/:slug 路由
 * 官网级视觉 · 无登录访问 · 验真动效 · 反向引流
 * 
 * 标注：【Mock】SM3哈希验证、OCSP查询、区块链存证均为模拟
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle2, ExternalLink, Fingerprint,
  Building2, User, Calendar, Hash, Lock, ArrowRight
} from 'lucide-react';

/** 验真状态 */
type VerifyState = 'loading' | 'verified' | 'failed';

/** Mock背书数据 */
const MOCK_ENDORSEMENT = {
  candidate: '刘浩然',
  position: 'DevOps架构师',
  enterprise: '蜀道集团',
  department: 'HR部',
  certLevel: 'EV' as const,
  issueDate: '2024-03-14',
  expiryDate: '2025-03-14',
  sm2Signature: 'SM2:3a7f8c2d1e5b9f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a',
  sm3Hash: 'SM3:8b4e2f1a9c3d5e7f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e',
  ocspStatus: 'Good',
  chainValid: true,
  verifiedCount: 23,
};

export default function EndorsementVerify() {
  const [state, setState] = useState<VerifyState>('loading');
  const [verifyStep, setVerifyStep] = useState(0);

  useEffect(() => {
    // 模拟验真过程
    const steps = [1, 2, 3, 4];
    const timers = steps.map((_, i) =>
      setTimeout(() => setVerifyStep(i + 1), (i + 1) * 500)
    );
    timers.push(setTimeout(() => setState('verified'), 2500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-50 to-white">
      {/* 顶部品牌栏 */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-trust-500 to-trust-700 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">蓉才通™</h1>
              <p className="text-[10px] text-muted">可信人才决策操作系统</p>
            </div>
          </div>
          <a href="#" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
            了解更多 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* 验真卡片 */}
        <div className="bg-surface rounded-3xl border border-border shadow-e3 overflow-hidden">
          {/* 卡片头部 */}
          <div className="bg-gradient-to-r from-trust-600 to-trust-700 px-8 py-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Fingerprint className="w-6 h-6 text-trust-200" />
              <h2 className="text-xl font-semibold">人才背书验真</h2>
            </div>
            <p className="text-sm text-trust-100">基于四川CA国密SM2数字签名的可信人才背书</p>
          </div>

          <div className="p-8">
            {/* 验真进度 */}
            <AnimatePresence mode="wait">
              {state === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-brand-600 animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-foreground">正在验证签名完整性...</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['SM3哈希', 'SM2签名', 'OCSP', '证书链'].map((label, i) => (
                      <div key={label} className={`text-center p-2 rounded-lg transition-colors ${
                        i < verifyStep ? 'bg-trust-50 border border-trust-200' : 'bg-ink-50 border border-border'
                      }`}>
                        <div className={`w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center ${
                          i < verifyStep ? 'bg-trust-500' : 'bg-ink-200'
                        }`}>
                          {i < verifyStep ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-ink-400" />
                          )}
                        </div>
                        <span className={`text-[10px] font-medium ${i < verifyStep ? 'text-trust-700' : 'text-muted'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {state === 'verified' && (
                <motion.div
                  key="verified"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* 验真通过印章 */}
                  <div className="flex items-center gap-4 mb-8 p-4 bg-trust-50 rounded-2xl border border-trust-200">
                    <motion.div
                      initial={{ scale: 2, rotate: -15, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-trust-500 to-trust-700 flex items-center justify-center shadow-lg flex-shrink-0"
                    >
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-lg font-semibold text-trust-800">验真通过</p>
                      <p className="text-sm text-trust-600">该背书由四川CA EV企业证书签发，签名完整有效</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted">已被验证</p>
                      <p className="text-lg font-bold text-trust-700 tabular-nums">{MOCK_ENDORSEMENT.verifiedCount} 次</p>
                    </div>
                  </div>

                  {/* 背书详情 */}
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">候选人</p>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted" />
                          <span className="text-sm font-medium text-foreground">{MOCK_ENDORSEMENT.candidate}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">推荐岗位</p>
                        <span className="text-sm font-medium text-foreground">{MOCK_ENDORSEMENT.position}</span>
                      </div>
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">签发日期</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted" />
                          <span className="text-sm text-foreground">{MOCK_ENDORSEMENT.issueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">签名主体</p>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-trust-600" />
                          <span className="text-sm font-medium text-foreground">{MOCK_ENDORSEMENT.enterprise} · {MOCK_ENDORSEMENT.department}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">证书等级</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-seal-ev/10 text-seal-ev text-xs font-semibold rounded">
                          <Shield className="w-3 h-3" /> EV 企业证书
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wider mb-1">OCSP状态</p>
                        <span className="text-sm text-trust-600 font-medium">{MOCK_ENDORSEMENT.ocspStatus}</span>
                      </div>
                    </div>
                  </div>

                  {/* 密码学证据 */}
                  <div className="bg-ink-50 rounded-xl p-4 border border-border mb-6">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> 密码学证据
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-muted">SM2签名</span>
                        <p className="font-hash text-muted break-all">{MOCK_ENDORSEMENT.sm2Signature}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted">SM3哈希</span>
                        <p className="font-hash text-muted break-all">{MOCK_ENDORSEMENT.sm3Hash}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted mt-3">【Mock】以上密码学证据为演示数据</p>
                  </div>

                  {/* 反向引流 CTA */}
                  <div className="bg-gradient-to-r from-brand-50 to-indigo-50 rounded-2xl p-6 border border-brand-100 text-center">
                    <h3 className="text-base font-semibold text-foreground mb-2">想为您的企业建立可信人才背书体系？</h3>
                    <p className="text-sm text-muted mb-4">蓉才通™ — 基于四川CA国密SM2的可信人才决策操作系统</p>
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                      申请试用 <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 底部 */}
        <footer className="text-center mt-8 text-xs text-muted">
          <p>© 2024 蓉才通™ · 四川省数字证书认证管理中心</p>
          <p className="mt-1">国密SM2/SM3 · 司法级可信身份 · 区块链存证</p>
        </footer>
      </main>
    </div>
  );
}
