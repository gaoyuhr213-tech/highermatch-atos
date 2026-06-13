import { Shield, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface CABadgeProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'card' | 'banner';
  companyName?: string;
  showTooltip?: boolean;
}

export default function CABadge({ size = 'md', variant = 'inline', companyName, showTooltip = true }: CABadgeProps) {
  const sizeClasses = {
    sm: 'h-5 text-[10px] gap-1 px-1.5',
    md: 'h-6 text-xs gap-1.5 px-2',
    lg: 'h-8 text-sm gap-2 px-3',
  };

  const iconSizes = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' };

  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-50 via-white to-trust-50 rounded-xl border border-brand-100/60 shadow-glass"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{companyName || 'CA认证真实企业'}</span>
            <CheckCircle className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-[10px] text-muted mt-0.5">四川CA · U盾硬件实名认证 · 国密SM2签名验证通过</p>
        </div>
        <div className="px-2.5 py-1 bg-trust-50 rounded-md border border-trust-200">
          <span className="text-[10px] font-semibold text-trust-700">信任已验证</span>
        </div>
      </motion.div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-brand-50/80 rounded-lg border border-brand-100/60">
        <Shield className="w-4 h-4 text-brand-600" />
        <div>
          <span className="text-xs font-semibold text-brand-700">CA认证企业</span>
          {companyName && <span className="text-xs text-muted ml-1.5">{companyName}</span>}
        </div>
        <CheckCircle className="w-3.5 h-3.5 text-trust-500" />
      </div>
    );
  }

  // inline variant
  return (
    <span className={`inline-flex items-center rounded-full bg-brand-50 border border-brand-100/60 font-semibold text-brand-700 ${sizeClasses[size]}`}
      title={showTooltip ? '四川CA · U盾硬件实名认证 · 国密SM2签名验证' : undefined}>
      <Shield className={iconSizes[size]} />
      <span>CA认证</span>
      <CheckCircle className={`${iconSizes[size]} text-trust-500`} />
    </span>
  );
}
