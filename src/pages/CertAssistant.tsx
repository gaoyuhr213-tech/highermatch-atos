/**
 * 证书助手标准界面 — PRD §6 入场流程（最高优先级）
 * 
 * 1:1还原：顶部栏、左侧导航、推荐应用、福利专区、蓉才通独立图标、
 * 右侧证书操作区、公告栏、底部版权信息
 * 
 * 入场链路：模拟插入证书→企业身份识别→蓉才通图标点亮→可信入场Splash→认证态首页
 * 未插证书点击蓉才通：抖动反馈+文字提示
 * 
 * 标注：【Mock】证书检测、U盾交互、SM2/SM3、CA校验全部为模拟
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, FileText, Key, CheckCircle2, AlertCircle,
  MonitorSmartphone, Settings, HelpCircle, Bell, User,
  Bookmark, Award, Clock, ChevronRight, Lock,
  Building2, Fingerprint, Loader2
} from 'lucide-react';
import { useTrustedSession, DEMO_IDENTITY } from '../lib/trust/session';

/** 入场流程阶段 */
type EntryPhase = 'idle' | 'cert-detected' | 'identity-verified' | 'splash' | 'complete';

/** 可信入场Splash校验步骤 */
const SPLASH_STEPS = [
  { id: 'cert-chain', label: '证书链验证', detail: 'SM2签名 → 四川CA根证书' },
  { id: 'ocsp', label: 'OCSP在线校验', detail: '证书吊销状态检查' },
  { id: 'enterprise', label: '企业身份匹配', detail: '统一社会信用代码核验' },
  { id: 'scope', label: '权限范围确认', detail: '席位授权 · 操作人绑定' },
  { id: 'session', label: '安全会话建立', detail: 'ScopedToken签发' },
];

export default function CertAssistant() {
  const { setIdentity } = useTrustedSession();
  const [certInserted, setCertInserted] = useState(false);
  const [phase, setPhase] = useState<EntryPhase>('idle');
  const [shakeRongcai, setShakeRongcai] = useState(false);
  const [splashStep, setSplashStep] = useState(-1);
  const [showTip, setShowTip] = useState(false);

  // 模拟插入证书
  const handleInsertCert = useCallback(() => {
    setCertInserted(true);
    setPhase('cert-detected');
    // 1.5s后自动识别企业身份
    setTimeout(() => setPhase('identity-verified'), 1500);
  }, []);

  // 点击蓉才通图标
  const handleRongcaiClick = useCallback(() => {
    if (!certInserted) {
      // PRD: 未插证书→抖动+文字提示
      setShakeRongcai(true);
      setShowTip(true);
      setTimeout(() => setShakeRongcai(false), 500);
      setTimeout(() => setShowTip(false), 3000);
      return;
    }
    if (phase === 'identity-verified') {
      setPhase('splash');
    }
  }, [certInserted, phase]);

  // Splash校验步骤逐一点亮
  useEffect(() => {
    if (phase !== 'splash') return;
    setSplashStep(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    SPLASH_STEPS.forEach((_, idx) => {
      timers.push(setTimeout(() => setSplashStep(idx), (idx + 1) * 600));
    });
    // 全部完成后进入认证态
    timers.push(setTimeout(() => {
      setPhase('complete');
      setIdentity(DEMO_IDENTITY);
    }, (SPLASH_STEPS.length + 1) * 600));
    return () => timers.forEach(clearTimeout);
  }, [phase, setIdentity]);

  // Splash页面
  if (phase === 'splash') {
    return (
      <div className="fixed inset-0 bg-ink-950 flex items-center justify-center z-50" data-theme="dark">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8"
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-trust-500 to-trust-700 flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white text-center mb-2">可信入场校验</h2>
          <p className="text-sm text-ink-400 text-center mb-8">正在建立安全会话...</p>

          {/* 校验步骤 */}
          <div className="space-y-3">
            {SPLASH_STEPS.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0.4 }}
                animate={{
                  opacity: idx <= splashStep ? 1 : 0.4,
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  idx <= splashStep ? 'bg-trust-600/10 border border-trust-500/30' : 'bg-ink-800/50 border border-ink-700/30'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  idx <= splashStep ? 'bg-trust-500' : 'bg-ink-700'
                }`}>
                  {idx <= splashStep ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-xs text-ink-400">{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${idx <= splashStep ? 'text-white' : 'text-ink-500'}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs ${idx <= splashStep ? 'text-trust-400' : 'text-ink-600'}`}>
                    {step.detail}
                  </p>
                </div>
                {idx === splashStep + 1 && (
                  <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Mock标注 */}
          <p className="text-center text-xs text-ink-600 mt-6 font-mono">
            【Mock】SM2签名 · SM3哈希 · OCSP · CA网关 均为模拟
          </p>
        </motion.div>
      </div>
    );
  }

  // 证书助手标准界面
  return (
    <div className="h-screen flex flex-col bg-ink-100 overflow-hidden select-none">
      {/* ─── 顶部栏 ─── */}
      <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <Key className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">证书助手</span>
          <span className="text-xs text-muted">v3.2.1</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-muted">
          <button className="p-1.5 hover:bg-ink-100 rounded"><Bell className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-ink-100 rounded"><Settings className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-ink-100 rounded"><HelpCircle className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-ink-200" />
          <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-ink-100 rounded">
            <User className="w-4 h-4" />
            <span className="text-xs">管理员</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── 左侧导航 ─── */}
        <aside className="w-52 bg-surface border-r border-border flex flex-col py-3 flex-shrink-0">
          <nav className="flex-1 px-2 space-y-0.5">
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
              <MonitorSmartphone className="w-4 h-4" />
              <span>证书管理</span>
            </a>
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <FileText className="w-4 h-4" />
              <span>签名验签</span>
            </a>
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <Lock className="w-4 h-4" />
              <span>加密解密</span>
            </a>
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <Clock className="w-4 h-4" />
              <span>时间戳</span>
            </a>
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <Bookmark className="w-4 h-4" />
              <span>证书收藏</span>
            </a>

            {/* 分隔 */}
            <div className="!my-3 border-t border-border" />
            <p className="px-3 text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">推荐应用</p>

            {/* ─── 蓉才通入口（核心） ─── */}
            <button
              onClick={handleRongcaiClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                phase === 'identity-verified'
                  ? 'bg-trust-50 text-trust-700 font-semibold ring-1 ring-trust-200 animate-pulse-glow'
                  : certInserted
                    ? 'bg-ink-50 text-foreground hover:bg-ink-100'
                    : 'text-muted cursor-not-allowed'
              } ${shakeRongcai ? 'animate-shake' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                phase === 'identity-verified'
                  ? 'bg-gradient-to-br from-trust-500 to-trust-700 shadow-sm'
                  : certInserted
                    ? 'bg-ink-200'
                    : 'bg-ink-100'
              }`}>
                <Shield className={`w-4 h-4 ${
                  phase === 'identity-verified' ? 'text-white' : 'text-muted'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <span className="block leading-tight">蓉才通™</span>
                {phase === 'identity-verified' && (
                  <span className="text-[10px] text-trust-600">可信入场就绪</span>
                )}
              </div>
              {phase === 'identity-verified' && (
                <ChevronRight className="w-4 h-4 text-trust-500" />
              )}
            </button>

            {/* 抖动提示 */}
            <AnimatePresence>
              {showTip && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mx-2 mt-1 px-2.5 py-1.5 bg-warn-50 border border-warn-200 rounded-lg"
                >
                  <p className="text-xs text-warn-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    请先插入企业U盾证书
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 其他推荐应用 */}
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <Award className="w-4 h-4 text-muted" />
              <span>电子合同</span>
            </a>
            <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-ink-50 text-sm">
              <Building2 className="w-4 h-4 text-muted" />
              <span>企业信用</span>
            </a>
          </nav>

          {/* 福利专区 */}
          <div className="px-3 pt-3 border-t border-border mt-2">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">福利专区</p>
              <p className="text-[10px] text-blue-600/70">证书续期优惠 · 新用户礼包</p>
            </div>
          </div>
        </aside>

        {/* ─── 主内容区 ─── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* 右侧证书操作区 */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              {/* 证书状态卡片 */}
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">证书状态</h2>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    certInserted ? 'bg-trust-50 text-trust-700' : 'bg-ink-100 text-muted'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${certInserted ? 'bg-trust-500' : 'bg-ink-400'}`} />
                    {certInserted ? '已检测到证书' : '未检测到证书'}
                  </span>
                </div>

                {certInserted ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-trust-50 rounded-xl border border-trust-100">
                      <Fingerprint className="w-5 h-5 text-trust-600" />
                      <div>
                        <p className="text-sm font-medium text-foreground">蜀道集团 · EV企业证书</p>
                        <p className="text-xs text-muted font-mono">SN: SCCA-EV-2024-3A7F | 有效期至 2025-12-31</p>
                      </div>
                    </div>
                    {phase === 'cert-detected' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100"
                      >
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <p className="text-sm text-blue-700">正在识别企业身份...</p>
                      </motion.div>
                    )}
                    {phase === 'identity-verified' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 bg-trust-50 rounded-xl border border-trust-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-trust-600" />
                        <p className="text-sm text-trust-700">企业身份已确认 — 点击左侧「蓉才通™」进入</p>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                      <Key className="w-7 h-7 text-muted" />
                    </div>
                    <p className="text-sm text-muted mb-2">请插入企业U盾</p>
                    <p className="text-xs text-muted mb-4">支持四川CA SM2国密证书</p>
                    <button
                      onClick={handleInsertCert}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                    >
                      <MonitorSmartphone className="w-4 h-4" />
                      模拟插入证书
                    </button>
                    <p className="text-[10px] text-muted mt-3">【Mock】此为演示环境，模拟U盾插入动作</p>
                  </div>
                )}
              </div>

              {/* 公告栏 */}
              <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted" />
                  公告
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded">新</span>
                    <span className="text-muted">蓉才通™ v4.0 AI Recruiting OS 正式发布</span>
                    <span className="text-xs text-muted ml-auto">2024-03-15</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-1.5 py-0.5 bg-ink-100 text-muted text-[10px] font-medium rounded">通知</span>
                    <span className="text-muted">四川CA根证书已更新，请及时同步</span>
                    <span className="text-xs text-muted ml-auto">2024-03-12</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-1.5 py-0.5 bg-ink-100 text-muted text-[10px] font-medium rounded">通知</span>
                    <span className="text-muted">SM2证书续期优惠活动进行中</span>
                    <span className="text-xs text-muted ml-auto">2024-03-10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部版权信息 */}
          <footer className="px-6 py-3 border-t border-border bg-surface flex items-center justify-between text-xs text-muted flex-shrink-0">
            <span>© 2024 四川省数字证书认证管理中心 · 四川CA</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
              <AlertCircle className="w-3 h-3" />
              演示环境 · 模拟
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
