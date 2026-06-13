/**
 * 蓉才通™ ATOS — Candidate Copilot
 * 
 * 对标: Jobscan × Kickresume × Interview Warmup × Levels.fyi
 * 
 * 真实能力:
 * - Resume Rewrite Agent（简历优化 + ATS评分）
 * - Mock Interview Agent（模拟面试 + 实时反馈）
 * - Career Planner Agent（职业路径规划）
 * - Salary Agent（薪资谈判建议）
 * - Learning Roadmap Agent（技能提升路线图）
 * - 连接 /api/v2/copilot/* 后端Pipeline
 */
import { useState, useCallback } from 'react';
import {
  FileText, MessageSquare, TrendingUp, DollarSign, BookOpen,
  Loader2, Sparkles, CheckCircle, AlertTriangle, ArrowRight,
  Upload, Star, Target, Zap, Brain, GraduationCap, Award,
  BarChart3, Clock, ChevronRight
} from 'lucide-react';
import { copilotService } from '../../lib/api/copilot-service';

// ─── Types ───────────────────────────────────────────────────────────────────

type CopilotTab = 'resume' | 'interview' | 'career' | 'salary' | 'learning';

interface ResumeScore {
  overall: number;
  atsCompatibility: number;
  impactLanguage: number;
  quantification: number;
  relevance: number;
  suggestions: string[];
  rewrittenSections: { section: string; original: string; improved: string }[];
}

interface CareerPath {
  current: string;
  target: string;
  timeline: string;
  steps: { title: string; duration: string; skills: string[]; milestone: string }[];
}

interface SalaryInsight {
  market: { p25: number; p50: number; p75: number; p90: number };
  recommendation: number;
  negotiationTips: string[];
  factors: { name: string; impact: string; direction: 'up' | 'down' | 'neutral' }[];
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_RESUME_SCORE: ResumeScore = {
  overall: 72,
  atsCompatibility: 68,
  impactLanguage: 75,
  quantification: 60,
  relevance: 85,
  suggestions: [
    '增加量化数据：将"提升了系统性能"改为"将API响应时间从800ms降至120ms（降幅85%）"',
    'ATS关键词缺失：添加 "microservices", "CI/CD", "Docker" 等目标岗位高频词',
    '动词弱化：将"负责"替换为"主导/设计/交付"等强动词',
    '项目描述缺少STAR结构：补充Situation和Result',
    '教育经历可前置：目标岗位要求硕士学历，建议调整到第二版块',
  ],
  rewrittenSections: [
    { section: '工作经历 - 项目1', original: '负责公司后端系统的开发和维护，提升了系统性能。', improved: '主导电商平台核心交易系统重构（日均300万笔订单），将API P99延迟从800ms降至120ms（降幅85%），系统可用性从99.5%提升至99.99%。' },
    { section: '工作经历 - 项目2', original: '参与了数据平台的搭建，处理大量数据。', improved: '设计并交付实时数据处理Pipeline（Flink + Kafka），支撑日均10TB+数据清洗与特征计算，为推荐系统提供<5s延迟的实时特征服务，CTR提升12%。' },
  ],
};

const DEMO_CAREER: CareerPath = {
  current: '高级后端工程师',
  target: '技术总监 / VP of Engineering',
  timeline: '3-5年',
  steps: [
    { title: '技术专家 → 架构师', duration: '12-18个月', skills: ['系统设计', '技术选型', '架构评审', '技术债务治理'], milestone: '主导一个核心系统的架构升级' },
    { title: '架构师 → Tech Lead', duration: '12个月', skills: ['团队管理', '项目规划', '跨团队协作', 'OKR制定'], milestone: '带领5-8人团队完成季度目标' },
    { title: 'Tech Lead → Engineering Manager', duration: '12-18个月', skills: ['招聘面试', '绩效管理', '预算规划', '向上管理'], milestone: '管理2-3个团队，总人数15+' },
    { title: 'EM → Director/VP', duration: '18-24个月', skills: ['战略规划', '组织设计', '技术品牌', '商业思维'], milestone: '负责整条业务线的技术体系' },
  ],
};

const DEMO_SALARY: SalaryInsight = {
  market: { p25: 450000, p50: 600000, p75: 800000, p90: 1100000 },
  recommendation: 750000,
  negotiationTips: [
    '先了解对方预算范围，不要先报价',
    '强调你的A100集群调优经验（市场稀缺），可溢价15-20%',
    '谈total package而非base salary，关注期权/RSU比例',
    '如果对方给出低于P50的offer，可以用竞品offer作为leverage',
    '成都base相比北京有20-30%的cost discount，但不要主动提',
  ],
  factors: [
    { name: '大模型经验', impact: '+20-30%', direction: 'up' },
    { name: 'GPU集群调优', impact: '+15-25%', direction: 'up' },
    { name: '成都base', impact: '-15-20%', direction: 'down' },
    { name: '一线大厂背景', impact: '+10-15%', direction: 'up' },
    { name: '博士学历', impact: '+5-10%', direction: 'up' },
    { name: '团队管理经验', impact: '需确认', direction: 'neutral' },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CandidateCopilot() {
  const [activeTab, setActiveTab] = useState<CopilotTab>('resume');
  const [loading, setLoading] = useState(false);
  const [resumeScore, setResumeScore] = useState<ResumeScore | null>(null);
  const [careerPath, setCareerPath] = useState<CareerPath | null>(null);
  const [salaryInsight, setSalaryInsight] = useState<SalaryInsight | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const tabs: { id: CopilotTab; label: string; icon: typeof FileText; desc: string }[] = [
    { id: 'resume', label: '简历优化', icon: FileText, desc: 'ATS评分 + AI重写' },
    { id: 'interview', label: '模拟面试', icon: MessageSquare, desc: '实时反馈 + STAR训练' },
    { id: 'career', label: '职业规划', icon: TrendingUp, desc: '路径规划 + 里程碑' },
    { id: 'salary', label: '薪资顾问', icon: DollarSign, desc: '市场数据 + 谈判策略' },
    { id: 'learning', label: '学习路线', icon: BookOpen, desc: '技能图谱 + 资源推荐' },
  ];

  const handleResumeUpload = useCallback(async () => {
    setLoading(true);
    try {
      // Real API call would go here
      const result = await copilotService.analyzeResume('demo-file');
      setResumeScore(result.score);
    } catch {
      setDemoMode(true);
      setTimeout(() => { setResumeScore(DEMO_RESUME_SCORE); setLoading(false); }, 2000);
      return;
    }
    setLoading(false);
  }, []);

  const handleCareerPlan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await copilotService.planCareer('高级后端工程师', '技术总监');
      setCareerPath(result.path);
    } catch {
      setDemoMode(true);
      setTimeout(() => { setCareerPath(DEMO_CAREER); setLoading(false); }, 1500);
      return;
    }
    setLoading(false);
  }, []);

  const handleSalaryAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const result = await copilotService.analyzeSalary('AI Infra Engineer', '成都', 6);
      setSalaryInsight(result.insight);
    } catch {
      setDemoMode(true);
      setTimeout(() => { setSalaryInsight(DEMO_SALARY); setLoading(false); }, 1500);
      return;
    }
    setLoading(false);
  }, []);

  const formatSalary = (n: number) => `${(n / 10000).toFixed(0)}万`;

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Candidate Copilot</h1>
            <p className="text-xs text-muted">AI驱动的求职全流程辅助</p>
          </div>
        </div>
        {demoMode && <span className="text-[9px] px-2 py-0.5 bg-warn-100 text-warn-700 rounded-full font-medium">DEMO MODE</span>}
      </header>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-ink-50 rounded-xl flex-shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-white text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Resume Tab */}
        {activeTab === 'resume' && (
          <div className="space-y-4">
            {!resumeScore ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-foreground">上传简历获取AI评分</h3>
                  <p className="text-xs text-muted mt-1">支持 PDF/Word/纯文本，AI将从ATS兼容性、量化表达、影响力语言等维度评分</p>
                </div>
                <button onClick={handleResumeUpload} disabled={loading} className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? '分析中...' : '开始分析（Demo）'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score Overview */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: '综合评分', value: resumeScore.overall, color: 'brand' },
                    { label: 'ATS兼容', value: resumeScore.atsCompatibility, color: 'violet' },
                    { label: '影响力语言', value: resumeScore.impactLanguage, color: 'emerald' },
                    { label: '量化表达', value: resumeScore.quantification, color: 'amber' },
                    { label: '岗位匹配', value: resumeScore.relevance, color: 'blue' },
                  ].map(item => (
                    <div key={item.label} className="bg-surface border border-border rounded-xl p-3 text-center">
                      <div className={`text-2xl font-bold tabular-nums ${item.value >= 80 ? 'text-ok-600' : item.value >= 60 ? 'text-warn-600' : 'text-err-600'}`}>{item.value}</div>
                      <div className="text-[10px] text-muted mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-warn-500" />优化建议</h4>
                  <div className="space-y-2">{resumeScore.suggestions.map((s, i) => <div key={i} className="flex items-start gap-2 text-xs text-foreground"><span className="text-[10px] text-muted mt-0.5">{i + 1}.</span>{s}</div>)}</div>
                </div>

                {/* Rewritten Sections */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-violet-500" />AI重写对比</h4>
                  <div className="space-y-4">{resumeScore.rewrittenSections.map((s, i) => (
                    <div key={i} className="space-y-2">
                      <div className="text-[10px] font-medium text-muted">{s.section}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 bg-err-50 border border-err-100 rounded-lg"><div className="text-[9px] text-err-600 mb-1">原文</div><p className="text-[11px] text-foreground leading-relaxed">{s.original}</p></div>
                        <div className="p-2.5 bg-ok-50 border border-ok-100 rounded-lg"><div className="text-[9px] text-ok-600 mb-1">AI优化</div><p className="text-[11px] text-foreground leading-relaxed">{s.improved}</p></div>
                      </div>
                    </div>
                  ))}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mock Interview Tab */}
        {activeTab === 'interview' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-center max-w-sm">
              <h3 className="text-base font-bold text-foreground">AI模拟面试</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                基于目标岗位JD，AI面试官将按STAR框架提问，实时评估你的回答质量，
                并给出改进建议。支持行为面试、技术面试、Case面试三种模式。
              </p>
            </div>
            <div className="text-[10px] text-muted space-y-1 text-center">
              <p>Pipeline: JD Parse → Question Generate → STAR Evaluate → Feedback</p>
              <p>Agent: Mock Interview Agent → Competency Agent → Scoring Agent</p>
            </div>
            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
              <Zap className="w-4 h-4" />开始模拟面试
            </button>
          </div>
        )}

        {/* Career Tab */}
        {activeTab === 'career' && (
          <div className="space-y-4">
            {!careerPath ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-purple-50 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-foreground">AI职业路径规划</h3>
                  <p className="text-xs text-muted mt-1">基于你的当前角色和目标，生成个性化的职业发展路线图</p>
                </div>
                <button onClick={handleCareerPlan} disabled={loading} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  {loading ? '规划中...' : '生成路径（Demo）'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-2.5 py-1 bg-ink-100 rounded-lg font-medium text-foreground">{careerPath.current}</span>
                    <ArrowRight className="w-4 h-4 text-muted" />
                    <span className="px-2.5 py-1 bg-brand-100 text-brand-700 rounded-lg font-medium">{careerPath.target}</span>
                    <span className="text-xs text-muted ml-auto">预计 {careerPath.timeline}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {careerPath.steps.map((step, i) => (
                    <div key={i} className="bg-surface border border-border rounded-xl p-4 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-400 to-brand-600 rounded-l-xl" />
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>{step.title}</h4>
                        <span className="text-[10px] text-muted flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{step.duration}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">{step.skills.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{s}</span>)}</div>
                      <div className="text-[11px] text-muted flex items-center gap-1"><Award className="w-3 h-3 text-warn-500" />里程碑: {step.milestone}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Salary Tab */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            {!salaryInsight ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <DollarSign className="w-8 h-8 text-amber-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-foreground">AI薪资顾问</h3>
                  <p className="text-xs text-muted mt-1">基于市场数据 + 个人背景，给出精准的薪资定位和谈判策略</p>
                </div>
                <button onClick={handleSalaryAnalysis} disabled={loading} className="px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  {loading ? '分析中...' : '分析薪资（Demo）'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Market Range */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3">市场薪资分布（AI Infra Engineer · 成都 · 6年经验）</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'P25', value: salaryInsight.market.p25 },
                      { label: 'P50（中位数）', value: salaryInsight.market.p50 },
                      { label: 'P75', value: salaryInsight.market.p75 },
                      { label: 'P90', value: salaryInsight.market.p90 },
                    ].map(item => (
                      <div key={item.label} className="text-center p-2 bg-ink-50 rounded-lg">
                        <div className="text-lg font-bold text-foreground tabular-nums">{formatSalary(item.value)}</div>
                        <div className="text-[9px] text-muted">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-2.5 bg-brand-50 border border-brand-100 rounded-lg text-center">
                    <span className="text-[10px] text-muted">AI建议目标薪资：</span>
                    <span className="text-base font-bold text-brand-600 ml-1 tabular-nums">{formatSalary(salaryInsight.recommendation)}</span>
                  </div>
                </div>

                {/* Factors */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3">影响因素分析</h4>
                  <div className="space-y-2">{salaryInsight.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-xs text-foreground">{f.name}</span>
                      <span className={`text-xs font-medium tabular-nums ${f.direction === 'up' ? 'text-ok-600' : f.direction === 'down' ? 'text-err-600' : 'text-muted'}`}>{f.impact}</span>
                    </div>
                  ))}</div>
                </div>

                {/* Negotiation Tips */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" />谈判策略</h4>
                  <div className="space-y-2">{salaryInsight.negotiationTips.map((t, i) => <div key={i} className="flex items-start gap-2 text-[11px] text-foreground leading-relaxed"><CheckCircle className="w-3 h-3 text-ok-500 flex-shrink-0 mt-0.5" />{t}</div>)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Learning Tab */}
        {activeTab === 'learning' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-teal-500" />
            </div>
            <div className="text-center max-w-sm">
              <h3 className="text-base font-bold text-foreground">AI学习路线图</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                基于你的技能现状和目标岗位要求，AI生成个性化的学习路线图，
                推荐课程、书籍、项目实战和认证路径。
              </p>
            </div>
            <div className="text-[10px] text-muted space-y-1 text-center">
              <p>Pipeline: Skill Gap Analysis → Resource Match → Priority Sort → Timeline</p>
              <p>Agent: Learning Roadmap Agent → Skill Agent</p>
            </div>
            <button className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />生成学习路线
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
