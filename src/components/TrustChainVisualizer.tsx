import { Shield, CheckCircle, Building2, FileText, Users, ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface TrustStep {
  id: number;
  icon: typeof Shield;
  title: string;
  subtitle: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  color: string;
  bgColor: string;
}

const trustSteps: TrustStep[] = [
  {
    id: 1, icon: Lock, title: 'U盾凭证', subtitle: '硬件实名登录',
    description: '企业以U盾/数字证书进行硬件级强实名登录，CA颁发权威凭证',
    status: 'completed', color: 'text-primary-600', bgColor: 'bg-primary-50'
  },
  {
    id: 2, icon: Shield, title: 'CA认证校验', subtitle: '身份写入信用底座',
    description: '验证通过后，实名身份写入企业信用底座，国密SM2签名确认',
    status: 'completed', color: 'text-trust-600', bgColor: 'bg-trust-50'
  },
  {
    id: 3, icon: Building2, title: '认证企业', subtitle: 'CA认证真实企业标识',
    description: '企业获得「CA认证真实企业」蓝标标识，一眼可信',
    status: 'completed', color: 'text-primary-600', bgColor: 'bg-primary-50'
  },
  {
    id: 4, icon: FileText, title: '真实岗位UGC', subtitle: '岗位真实答疑',
    description: '认证企业发布岗位真实答疑/薪资结构/工作实况，内容可信',
    status: 'active', color: 'text-amber-600', bgColor: 'bg-amber-50'
  },
  {
    id: 5, icon: Users, title: '候选人信任落地', subtitle: '信任成本断崖下降',
    description: '候选人看到「认证真企业说真话」，投递意愿显著提升',
    status: 'active', color: 'text-emerald-600', bgColor: 'bg-emerald-50'
  },
];

interface Props {
  compact?: boolean;
  onStepClick?: (step: number) => void;
}

export default function TrustChainVisualizer({ compact = false, onStepClick }: Props) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary-50 to-trust-50 rounded-xl border border-primary-100/50">
        <Shield className="w-4 h-4 text-primary-600" />
        <span className="text-xs font-semibold text-primary-700">信任传导链路</span>
        <div className="flex items-center gap-0.5 ml-2">
          {trustSteps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step.status === 'completed' ? 'bg-primary-500' : step.status === 'active' ? 'bg-amber-400' : 'bg-slate-200'}`}>
                <step.icon className="w-3 h-3 text-white" />
              </div>
              {i < trustSteps.length - 1 && (
                <div className={`w-4 h-0.5 ${i < 2 ? 'bg-primary-300' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <CheckCircle className="w-4 h-4 text-trust-500 ml-auto" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">信任传导链路</h3>
          <p className="text-xs text-slate-500">CA信任 → 认证企业 → 真实岗位 → 候选人 · 五步链路完整可演示</p>
        </div>
        <div className="ml-auto px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200">
          <span className="text-xs font-semibold text-trust-700">链路状态：运行中</span>
        </div>
      </div>

      {/* 五步链路可视化 */}
      <div className="relative">
        {/* 连接线 */}
        <div className="absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-200 via-primary-300 to-trust-200 mx-16 z-0" />
        
        <div className="grid grid-cols-5 gap-3 relative z-10">
          {trustSteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center cursor-pointer group"
              onMouseEnter={() => setHoveredStep(step.id)}
              onMouseLeave={() => setHoveredStep(null)}
              onClick={() => onStepClick?.(step.id)}
            >
              <div className={`w-16 h-16 rounded-2xl ${step.bgColor} border-2 ${
                hoveredStep === step.id ? 'border-primary-400 shadow-glass-hover scale-105' : 'border-transparent shadow-card'
              } flex items-center justify-center transition-all duration-200`}>
                <step.icon className={`w-7 h-7 ${step.color}`} />
              </div>
              
              {step.status === 'completed' && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-trust-500 rounded-full flex items-center justify-center border-2 border-white">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
              
              <div className="mt-3 text-center">
                <p className="text-xs font-bold text-slate-800">{step.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{step.subtitle}</p>
              </div>

              {/* Hover tooltip */}
              {hoveredStep === step.id && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full mt-2 w-48 p-3 bg-white rounded-xl border border-slate-200 shadow-elevated z-50"
                >
                  <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${step.status === 'completed' ? 'bg-trust-500' : 'bg-amber-400'}`} />
                    <span className="text-[10px] font-medium text-slate-500">
                      {step.status === 'completed' ? '已验证' : '运行中'}
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* 底部指标 */}
      <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-lg font-bold text-primary-600">SM2/SM3</p>
          <p className="text-[10px] text-slate-500">国密签名算法</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-trust-600">单一接口</p>
          <p className="text-[10px] text-slate-500">CA校验收敛设计</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-700">零信任</p>
          <p className="text-[10px] text-slate-500">越权访问一律拒绝</p>
        </div>
      </div>
    </div>
  );
}
