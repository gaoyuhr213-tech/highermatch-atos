/**
 * IdentityChip — 身份标识芯片
 * PRD §7.1: 区分签名主体与操作人
 * 
 * 双行展示：
 * - 签名主体（企业U盾SM2）
 * - 操作人（使用人·席位授权）
 */

import { Shield, User } from 'lucide-react';

interface Props {
  /** 签名主体（企业名） */
  signer: string;
  /** 证书等级 */
  certLevel: 'EV' | 'OV' | 'DV';
  /** 操作人 */
  operator: string;
  /** 证书序列号（截断展示） */
  certSerial?: string;
  /** 紧凑模式 */
  compact?: boolean;
}

const CERT_STYLES = {
  EV: { bg: 'bg-seal-ev/10', text: 'text-seal-ev', label: 'EV' },
  OV: { bg: 'bg-seal-ov/10', text: 'text-seal-ov', label: 'OV' },
  DV: { bg: 'bg-seal-dv/10', text: 'text-seal-dv', label: 'DV' },
};

export function IdentityChip({ signer, certLevel, operator, certSerial, compact = false }: Props) {
  const style = CERT_STYLES[certLevel];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-ink-50 rounded-lg border border-border">
        <Shield className={`w-3 h-3 ${style.text}`} />
        <span className="text-[10px] font-medium text-foreground">{signer}</span>
        <span className={`text-[9px] px-1 py-0.5 rounded ${style.bg} ${style.text} font-bold`}>{style.label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-2 bg-ink-50 rounded-xl border border-border">
      {/* 签名主体 */}
      <div className="flex items-center gap-2">
        <Shield className={`w-3.5 h-3.5 ${style.text}`} />
        <span className="text-xs font-medium text-foreground">{signer}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} font-bold`}>{style.label}</span>
        {certSerial && (
          <span className="text-[10px] text-muted font-mono ml-auto">
            SM2:{certSerial.slice(-8)}
          </span>
        )}
      </div>
      {/* 操作人 */}
      <div className="flex items-center gap-2 pl-5.5">
        <User className="w-3 h-3 text-muted" />
        <span className="text-[10px] text-muted">{operator}（席位授权）</span>
      </div>
    </div>
  );
}
