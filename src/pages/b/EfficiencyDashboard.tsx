import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Users, Clock, Target, ArrowUpRight, Shield, CheckCircle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import CABadge from '../../components/CABadge';

interface MetricCard {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'flat';
  baseline: string;
  note: string;
}

const metrics: MetricCard[] = [
  { label: '岗位到面率', value: '68%', change: '+22%', trend: 'up', baseline: '行业基线46%【待验证】', note: '认证企业到面/邀约比' },
  { label: '入职转化率', value: '82%', change: '+15%', trend: 'up', baseline: '行业基线67%【待验证】', note: '入职/offer比' },
  { label: '平均招聘周期', value: '18天', change: '-8天', trend: 'down', baseline: '行业均值26天【待验证】', note: '从发布到入职' },
  { label: '候选人投递意愿', value: '+35%', change: '显著提升', trend: 'up', baseline: '对比非认证企业【待验证】', note: '认证vs非认证投递率' },
];

interface ComparisonData {
  metric: string;
  certified: number;
  uncertified: number;
  unit: string;
}

const comparisonData: ComparisonData[] = [
  { metric: '平均投递量/岗', certified: 45, uncertified: 18, unit: '份' },
  { metric: '到面率', certified: 68, uncertified: 42, unit: '%' },
  { metric: '入职转化率', certified: 82, uncertified: 65, unit: '%' },
  { metric: '试用期留存', certified: 91, uncertified: 74, unit: '%' },
  { metric: '候选人满意度', certified: 4.6, uncertified: 3.8, unit: '/5' },
];

interface TimelineEvent {
  week: string;
  milestone: string;
  status: 'completed' | 'in_progress' | 'pending';
  output: string;
}

const sowTimeline: TimelineEvent[] = [
  { week: 'W1', milestone: 'CA接口对接+种子企业准入', status: 'completed', output: '认证企业可经U盾/CA登录' },
  { week: 'W2-W3', milestone: '认证标识+岗位真实答疑上线', status: 'completed', output: '企业蓝标+首批真实岗位内容' },
  { week: 'W4', milestone: 'B端决策社区+提效看板上线', status: 'in_progress', output: '同行圈+数据看板可用' },
  { week: 'W5-W6', milestone: '数据采集与复盘', status: 'pending', output: '首批到面/转化数据+复盘报告' },
];

export default function EfficiencyDashboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">招聘提效看板</h1>
          <p className="text-sm text-slate-500 mt-1">以数据看见「省了多少，招得多快」· 支撑续费与增值决策</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5">
            {(['week', 'month', 'quarter'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p === 'week' ? '本周' : p === 'month' ? '本月' : '本季'}
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-[10px] font-semibold text-amber-700">数据为方向性预估【待验证】</span>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl border border-slate-200/80 shadow-card p-5 hover:shadow-card-hover transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{metric.label}</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                metric.trend === 'up' ? 'bg-trust-50 text-trust-700' : metric.trend === 'down' ? 'bg-trust-50 text-trust-700' : 'bg-slate-50 text-slate-600'
              }`}>
                {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {metric.change}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
            <p className="text-[10px] text-slate-400 mt-2">{metric.baseline}</p>
            <p className="text-[10px] text-slate-400">{metric.note}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 认证vs非认证对比 */}
        <div className="col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">认证企业 vs 非认证企业</h3>
              <p className="text-xs text-slate-500 mt-0.5">CA认证信任传导效果对比</p>
            </div>
            <CABadge size="sm" />
          </div>

          <div className="space-y-3">
            {comparisonData.map((item, index) => {
              const maxVal = Math.max(item.certified, item.uncertified);
              return (
                <div key={item.metric} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">{item.metric}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-primary-600">{item.certified}{item.unit}</span>
                      <span className="text-xs text-slate-400">vs</span>
                      <span className="text-xs font-medium text-slate-500">{item.uncertified}{item.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.certified / maxVal) * 100}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                      />
                    </div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.uncertified / maxVal) * 100}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className="h-full bg-slate-300 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-primary-400 to-primary-600" />
              <span className="text-[10px] text-slate-500">CA认证企业</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-300" />
              <span className="text-[10px] text-slate-500">非认证企业</span>
            </div>
            <span className="text-[10px] text-amber-600 ml-auto">* 数据为方向性预估【待验证】</span>
          </div>
        </div>

        {/* P0试点SOW时间线 */}
        <div className="col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">P0试点里程碑</h3>
              <p className="text-xs text-slate-500 mt-0.5">4-6周验证信任传导链路</p>
            </div>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {sowTimeline.map((event, index) => (
              <div key={event.week} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    event.status === 'completed' ? 'bg-trust-500' :
                    event.status === 'in_progress' ? 'bg-primary-500' : 'bg-slate-200'
                  }`}>
                    {event.status === 'completed' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${event.status === 'in_progress' ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                    )}
                  </div>
                  {index < sowTimeline.length - 1 && (
                    <div className={`w-0.5 h-8 mt-1 ${event.status === 'completed' ? 'bg-trust-200' : 'bg-slate-200'}`} />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{event.week}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      event.status === 'completed' ? 'bg-trust-50 text-trust-700' :
                      event.status === 'in_progress' ? 'bg-primary-50 text-primary-700' : 'bg-slate-50 text-slate-500'
                    }`}>
                      {event.status === 'completed' ? '已完成' : event.status === 'in_progress' ? '进行中' : '待启动'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">{event.milestone}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">产出：{event.output}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
