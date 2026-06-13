/**
 * SignCeremony — 签名仪式组件
 * PRD §7.1: ceremony动效 800ms + 印章落地 + 状态机
 * 
 * 状态机：idle → signing → stamping → complete
 * 标注：【Mock】SM2签名为模拟
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, Loader2, Fingerprint } from 'lucide-react';

type CeremonyState = 'idle' | 'signing' | 'stamping' | 'complete';

interface Props {
  /** 签名主体 */
  signer: string;
  /** 证书等级 */
  certLevel: 'EV' | 'OV' | 'DV';
  /** 签名完成回调 */
  onComplete?: (signature: string) => void;
  /** 触发签名（受控） */
  trigger?: boolean;
  /** 操作人 */
  operator?: string;
}

export function SignCeremony({ signer, certLevel, onComplete, trigger, operator }: Props) {
  const [state, setState] = useState<CeremonyState>('idle');
  const [signature, setSignature] = useState('');

  const startCeremony = useCallback(() => {
    if (state !== 'idle') return;
    setState('signing');
    // 模拟SM2签名过程
    setTimeout(() => {
      setState('stamping');
      const mockSig = `SM2:${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      setSignature(mockSig);
    }, 1200);
  }, [state]);

  useEffect(() => {
    if (state === 'stamping') {
      // 印章动效完成
      const timer = setTimeout(() => {
        setState('complete');
        onComplete?.(signature);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state, signature, onComplete]);

  useEffect(() => {
    if (trigger && state === 'idle') {
      startCeremony();
    }
  }, [trigger, state, startCeremony]);

  const sealColor = certLevel === 'EV' ? 'from-trust-500 to-trust-700' : certLevel === 'OV' ? 'from-brand-500 to-brand-700' : 'from-ink-400 to-ink-600';

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="idle"
            onClick={startCeremony}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Fingerprint className="w-4 h-4" />
            CA签名确认
          </motion.button>
        )}

        {state === 'signing' && (
          <motion.div
            key="signing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100"
          >
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-brand-800">SM2签名中...</p>
              <p className="text-[10px] text-brand-600">{signer} · {certLevel}证书</p>
            </div>
          </motion.div>
        )}

        {state === 'stamping' && (
          <motion.div
            key="stamping"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative flex items-center gap-3 px-4 py-3 bg-trust-50 rounded-xl border border-trust-200"
          >
            {/* 印章动效 */}
            <motion.div
              initial={{ scale: 2, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${sealColor} flex items-center justify-center shadow-lg`}
            >
              <Shield className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-trust-800">签名确认中</p>
              <p className="text-[10px] text-trust-600 font-mono">{signature}</p>
            </div>
          </motion.div>
        )}

        {state === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-trust-50 rounded-xl border border-trust-200"
          >
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${sealColor} flex items-center justify-center shadow-md`}>
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-trust-800">签名完成</p>
              <p className="text-[10px] text-trust-600">
                {signer} · {operator && `操作人: ${operator} · `}
                <span className="font-mono">{signature}</span>
              </p>
            </div>
            <span className="text-[10px] text-muted">【Mock】</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
