import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, KeyRound, FileCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { useApp } from '../App';

type Step = 'detect' | 'pin' | 'sign' | 'auth' | 'done';
const steps: { key: Step; label: string }[] = [
  { key: 'detect', label: 'U盾检测' }, { key: 'pin', label: 'PIN码校验' },
  { key: 'sign', label: 'SM2签名' }, { key: 'auth', label: 'CA鉴权' }, { key: 'done', label: '完成' },
];

export default function UShieldLogin() {
  const { setAuthenticated } = useApp();
  const [step, setStep] = useState<Step>('detect');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step === 'detect') { const t = setTimeout(() => setStep('pin'), 2500); return () => clearTimeout(t); }
    if (step === 'sign') { const i = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(i); setStep('auth'); return 100; } return p + 4; }), 80); return () => clearInterval(i); }
    if (step === 'auth') { const t = setTimeout(() => setStep('done'), 2000); return () => clearTimeout(t); }
    if (step === 'done') { const t = setTimeout(() => setAuthenticated(true), 1200); return () => clearTimeout(t); }
  }, [step, setAuthenticated]);

  const handlePin = () => {
    if (pin.length < 6) { setPinError('PIN码至少6位'); return; }
    if (pin === '000000') { setPinError('PIN码无效'); return; }
    setPinError(''); setStep('sign'); setProgress(0);
  };

  const currentIdx = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-primary-50/30 to-ink-50 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">蓉才通™</h1>
          <p className="text-sm text-muted mt-1">HigherMatch — 自主人才操作系统</p>
        </div>
        <div className="bg-surface rounded-3xl border border-border/80 shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < currentIdx ? 'bg-brand-500 text-white' : i === currentIdx ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500/30' : 'bg-ink-100 text-muted'}`}>
                  {i < currentIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`w-6 h-0.5 mx-1 ${i < currentIdx ? 'bg-brand-500' : 'bg-ink-200'}`} />}
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {step === 'detect' && (
              <motion.div key="detect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <Loader2 className="w-12 h-12 text-brand-500 mx-auto animate-spin mb-4" />
                <p className="text-lg font-semibold text-foreground">正在检测U盾设备...</p>
                <p className="text-sm text-muted mt-2">请确保国密U盾已插入USB端口</p>
                <div className="mt-4 p-3 bg-brand-50 rounded-xl"><p className="text-xs text-brand-700 font-mono">设备: SCCA-SM2-2024 | SN: 8A3F...C2D1</p></div>
              </motion.div>
            )}
            {step === 'pin' && (
              <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-4">
                <div className="text-center mb-6">
                  <KeyRound className="w-10 h-10 text-brand-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-foreground">输入U盾PIN码</p>
                  <p className="text-sm text-muted mt-1">请输入6位数字PIN码以解锁私钥</p>
                </div>
                <div className="space-y-4">
                  <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePin()} placeholder="请输入PIN码" maxLength={8} autoFocus className="w-full px-4 py-3 border border-border rounded-xl text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all" />
                  {pinError && <p className="text-sm text-red-500 text-center">{pinError}</p>}
                  <button onClick={handlePin} className="w-full px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors shadow-sm">验证PIN码</button>
                </div>
                <p className="text-xs text-muted text-center mt-4">证书: CN=四川CA测试证书, O=SCCA</p>
              </motion.div>
            )}
            {step === 'sign' && (
              <motion.div key="sign" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <FileCheck className="w-10 h-10 text-brand-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">SM2数字签名中...</p>
                <div className="mt-4 w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted mt-3 font-mono">SM2签名 | SM3哈希 | CRL/OCSP验证</p>
              </motion.div>
            )}
            {step === 'auth' && (
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <Loader2 className="w-10 h-10 text-emerald-500 mx-auto animate-spin mb-4" />
                <p className="text-lg font-semibold text-foreground">CA身份鉴权中...</p>
                <div className="mt-4 space-y-2 text-left p-3 bg-ink-50 rounded-xl">
                  <p className="text-xs text-emerald-600">✓ 证书链验证通过</p>
                  <p className="text-xs text-emerald-600">✓ OCSP状态: Good</p>
                  <p className="text-xs text-muted animate-pulse">⟳ 身份鉴权请求中...</p>
                </div>
              </motion.div>
            )}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
                <p className="text-lg font-semibold text-foreground">身份验证成功</p>
                <p className="text-sm text-muted mt-2">正在进入决策总控台...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-muted mt-6">四川CA · 国密SM2/SM3 · 司法级可信身份</p>
      </motion.div>
    </div>
  );
}
