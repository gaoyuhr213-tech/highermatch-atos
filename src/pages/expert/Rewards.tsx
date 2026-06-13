import { Gift, TrendingUp, Award, Star } from 'lucide-react';

const history = [
  { action: '完成评审 #R-005', points: '+500', date: '2024-03-14' },
  { action: '完成评审 #R-004', points: '+400', date: '2024-03-10' },
  { action: '兑换京东卡', points: '-1000', date: '2024-03-08' },
  { action: '完成评审 #R-003', points: '+600', date: '2024-03-05' },
  { action: '邀请新专家', points: '+200', date: '2024-03-01' },
];

export default function Rewards() {
  return (
    <div className="p-8 max-w-[800px] mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-bold text-foreground">积分奖励</h1><p className="text-sm text-muted mt-1">Rewards · 专家贡献积分与兑换</p></div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card text-center"><Award className="w-8 h-8 text-brand-500 mx-auto mb-2" /><p className="text-2xl font-bold text-foreground">2,700</p><p className="text-xs text-muted">当前积分</p></div>
        <div className="stat-card text-center"><TrendingUp className="w-8 h-8 text-ok-500 mx-auto mb-2" /><p className="text-2xl font-bold text-foreground">15</p><p className="text-xs text-muted">已完成评审</p></div>
        <div className="stat-card text-center"><Star className="w-8 h-8 text-warn-500 mx-auto mb-2" /><p className="text-2xl font-bold text-foreground">金牌</p><p className="text-xs text-muted">专家等级</p></div>
      </div>
      <div className="glass-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">积分记录</h3>
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div><p className="text-sm text-foreground">{h.action}</p><p className="text-[10px] text-muted mt-0.5">{h.date}</p></div>
              <span className={`text-sm font-bold ${h.points.startsWith('+') ? 'text-ok-600' : 'text-risk-600'}`}>{h.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
