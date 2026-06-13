/**
 * OperatorBadge — 操作人标识
 * PRD §7.1: 区分签名主体与操作人
 * 审计日志、血统追溯中展示操作人信息
 */

import { User, Shield } from 'lucide-react';

interface Props {
  /** 操作人姓名 */
  name: string;
  /** 席位授权ID */
  seatId?: string;
  /** 角色 */
  role?: string;
  /** 是否为签名主体（企业U盾） */
  isSigner?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md';
}

export function OperatorBadge({ name, seatId, role, isSigner = false, size = 'sm' }: Props) {
  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        isSigner ? 'bg-seal-ev/10 text-seal-ev' : 'bg-ink-100 text-muted'
      }`}>
        {isSigner ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
        {name}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
      isSigner ? 'bg-seal-ev/5 border-seal-ev/20' : 'bg-ink-50 border-border'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
        isSigner ? 'bg-seal-ev/10' : 'bg-ink-200'
      }`}>
        {isSigner ? <Shield className="w-3 h-3 text-seal-ev" /> : <User className="w-3 h-3 text-muted" />}
      </div>
      <div>
        <p className={`text-xs font-medium ${isSigner ? 'text-seal-ev' : 'text-foreground'}`}>{name}</p>
        {(seatId || role) && (
          <p className="text-[9px] text-muted">
            {role && <span>{role}</span>}
            {seatId && <span className="font-mono ml-1">{seatId}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
