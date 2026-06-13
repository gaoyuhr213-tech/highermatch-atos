import { useState } from 'react';
import { Users, MessageCircle, ThumbsUp, Compass, ArrowRightLeft, Target, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface DecisionThread {
  id: string;
  author: string;
  avatar: string;
  type: 'offer_compare' | 'career_change' | 'growth_path';
  title: string;
  content: string;
  replies: number;
  helpful: number;
  timestamp: string;
  resolved: boolean;
  dataPoints: string[];
}

const mockThreads: DecisionThread[] = [
  {
    id: 'T-001', author: '匿名用户A', avatar: 'A', type: 'offer_compare',
    title: '蜀道集团 vs 川投数字，算法岗offer怎么选？',
    content: '两家都是CA认证企业，薪资差距不大（35K vs 38K）。蜀道偏基础设施AI，川投偏金融科技。想听听在这两家工作过的前辈建议...',
    replies: 23, helpful: 45, timestamp: '3小时前', resolved: false,
    dataPoints: ['蜀道集团到面率92%', '川投数字试用期留存88%']
  },
  {
    id: 'T-002', author: '匿名用户B', avatar: 'B', type: 'career_change',
    title: '传统制造业HR转互联网HRBP，30岁还来得及吗？',
    content: '在制造业做了5年招聘，想转型互联网HRBP。担心年龄和行业经验不匹配。有没有类似经历的朋友分享下转型路径？',
    replies: 56, helpful: 89, timestamp: '1天前', resolved: true,
    dataPoints: ['跨行业转型成功率67%【待验证】', '平均适应期3-6个月']
  },
  {
    id: 'T-003', author: '匿名用户C', avatar: 'C', type: 'growth_path',
    title: '技术管理 vs 技术专家路线，P7该怎么选？',
    content: '目前P7前端，公司给了两个方向：带10人团队做TL，或者继续深耕前端架构。两条路的天花板和风险分别是什么？',
    replies: 78, helpful: 134, timestamp: '2天前', resolved: true,
    dataPoints: ['技术管理薪资中位数+15%', '专家路线晋升周期平均18个月']
  },
];

const typeConfig = {
  offer_compare: { label: '选Offer', icon: ArrowRightLeft, color: 'text-brand-600 bg-brand-50 border-brand-100' },
  career_change: { label: '转行决策', icon: Compass, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  growth_path: { label: '成长路径', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
};

export default function DecisionHub() {
  const [activeType, setActiveType] = useState<string>('all');

  const filteredThreads = activeType === 'all'
    ? mockThreads
    : mockThreads.filter(t => t.type === activeType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">求职决策社区</h1>
          <p className="text-sm text-muted mt-1">真实数据辅助决策 · 同行经验陪伴 · 不再孤立做选择</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200">
            <Shield className="w-3.5 h-3.5 text-trust-600" />
            <span className="text-xs font-semibold text-trust-700">数据来源：CA认证企业</span>
          </div>
        </div>
      </div>

      {/* 类型筛选 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveType('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeType === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface text-muted border border-border hover:bg-ink-50'
          }`}
        >
          全部话题
        </button>
        {Object.entries(typeConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveType(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeType === key ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface text-muted border border-border hover:bg-ink-50'
            }`}
          >
            <config.icon className="w-4 h-4" />
            {config.label}
          </button>
        ))}
      </div>

      {/* 话题列表 */}
      <div className="space-y-4">
        {filteredThreads.map((thread, index) => {
          const typeConf = typeConfig[thread.type];
          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-surface rounded-xl border border-border/80 shadow-card p-5 hover:shadow-card-hover transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center text-muted text-sm font-bold flex-shrink-0">
                  {thread.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${typeConf.color}`}>
                      <typeConf.icon className="w-3 h-3" />
                      {typeConf.label}
                    </span>
                    {thread.resolved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-trust-600 bg-trust-50 border border-trust-100">
                        <CheckCircle className="w-3 h-3" />
                        已解决
                      </span>
                    )}
                    <span className="text-xs text-muted ml-auto">{thread.timestamp}</span>
                  </div>

                  <h3 className="text-base font-bold text-foreground">{thread.title}</h3>
                  <p className="text-sm text-muted mt-2 line-clamp-2">{thread.content}</p>

                  {/* 数据参考点 */}
                  {thread.dataPoints.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                      {thread.dataPoints.map((dp, i) => (
                        <span key={i} className="px-2 py-0.5 bg-brand-50 rounded text-[10px] font-medium text-brand-700 border border-brand-100">
                          {dp}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <MessageCircle className="w-3.5 h-3.5" />{thread.replies} 回复
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <ThumbsUp className="w-3.5 h-3.5" />{thread.helpful} 有帮助
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
