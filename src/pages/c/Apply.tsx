import { Rocket, Building2, MapPin, Clock, ChevronRight, CheckCircle2, Loader2, Send } from 'lucide-react';
import { useState } from 'react';

const jobs = [
  { id: '1', title: '高级算法工程师', company: '蜀道集团', location: '成都', salary: '40-60万', match: 92, tags: ['NLP', 'Python', 'ML'], posted: '2天前' },
  { id: '2', title: '前端架构师', company: '川投集团', location: '成都', salary: '35-55万', match: 88, tags: ['React', 'TypeScript'], posted: '3天前' },
  { id: '3', title: 'DevOps架构师', company: '五粮液数字化', location: '宜宾', salary: '38-52万', match: 85, tags: ['K8s', 'CI/CD'], posted: '1天前' },
  { id: '4', title: '数据科学家', company: '长虹集团', location: '绵阳', salary: '30-45万', match: 79, tags: ['PyTorch', 'CV'], posted: '5天前' },
  { id: '5', title: '产品总监', company: '新希望数科', location: '成都', salary: '50-70万', match: 76, tags: ['B端', 'AI产品'], posted: '4天前' },
];

type ApplyStatus = 'idle' | 'applying' | 'applied';

export default function Apply() {
  const [statuses, setStatuses] = useState<Record<string, ApplyStatus>>({});

  const handleApply = (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: 'applying' }));
    setTimeout(() => setStatuses(prev => ({ ...prev, [id]: 'applied' })), 1800);
  };

  const handleBatchApply = () => {
    const eligible = jobs.filter(j => j.match >= 80 && statuses[j.id] !== 'applied');
    eligible.forEach((j, i) => {
      setTimeout(() => {
        setStatuses(prev => ({ ...prev, [j.id]: 'applying' }));
        setTimeout(() => setStatuses(prev => ({ ...prev, [j.id]: 'applied' })), 1200);
      }, i * 600);
    });
  };

  const appliedCount = Object.values(statuses).filter(s => s === 'applied').length;

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">智能投递</h1><p className="text-sm text-muted mt-1">Smart Apply · AI匹配最优岗位一键投递</p></div>
        <div className="flex items-center gap-3">
          {appliedCount > 0 && <span className="badge badge-green">{appliedCount} 已投递</span>}
          <button onClick={handleBatchApply} className="btn-primary"><Send className="w-4 h-4" />一键投递匹配度≥80%</button>
        </div>
      </div>

      <div className="glass-card p-4 mb-6 flex items-center gap-3 bg-gradient-to-r from-brand-50 to-transparent border-l-4 border-l-brand-500">
        <Rocket className="w-5 h-5 text-brand-500" />
        <div>
          <p className="text-sm font-medium text-foreground">基于你的简历和职业画像，AI已为你匹配以下高适配岗位</p>
          <p className="text-xs text-muted mt-0.5">匹配算法综合考虑：技能覆盖度、行业经验、薪资期望、地理偏好</p>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.map(j => {
          const status = statuses[j.id] || 'idle';
          return (
            <div key={j.id} className={`glass-card p-5 flex items-center gap-5 group transition-all ${status === 'applied' ? 'border-l-4 border-l-success-400 bg-ok-50/20' : 'cursor-pointer hover:shadow-card'}`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">{j.title}</h3>
                  <span className={`badge ${j.match >= 90 ? 'badge-green' : j.match >= 80 ? 'badge-blue' : 'badge-yellow'}`}>{j.match}% 匹配</span>
                  {status === 'applied' && <span className="badge badge-green">已投递</span>}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{j.company}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{j.posted}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {j.tags.map(t => <span key={t} className="badge badge-blue text-[10px]">{t}</span>)}
                  <span className="text-sm font-semibold text-brand-600 ml-auto">{j.salary}</span>
                </div>
              </div>
              <div className="w-24 flex justify-end">
                {status === 'idle' && (
                  <button onClick={() => handleApply(j.id)} className="btn-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    投递<ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {status === 'applying' && (
                  <div className="flex items-center gap-2 text-brand-500">
                    <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">投递中</span>
                  </div>
                )}
                {status === 'applied' && (
                  <div className="flex items-center gap-2 text-ok-600">
                    <CheckCircle2 className="w-4 h-4" /><span className="text-xs font-medium">已投递</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
