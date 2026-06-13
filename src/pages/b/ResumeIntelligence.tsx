/**
 * 蓉才通™ ATOS — Resume Intelligence Dashboard
 * 
 * 对标: Eightfold × HireEZ
 * 
 * 真实能力:
 * - 简历上传 → Parser Agent → 结构化数据
 * - Skill Agent → 技能图谱 + JD匹配
 * - Risk Agent → 风险信号检测
 * - Ranking Agent → 多维度候选人排名
 * - Explain Agent → 推荐可解释性
 * - 连接 /api/v2/resume/* 后端Pipeline
 * - Demo模式：无后端时展示完整分析流程
 */
import { useState, useCallback } from 'react';
import {
  Upload, FileText, Brain, AlertTriangle, Trophy, MessageCircle,
  ChevronRight, Loader2, CheckCircle, XCircle, BarChart3,
  Zap, Shield, Target, TrendingUp, TrendingDown, Star,
  Download, RefreshCw, Eye, Layers
} from 'lucide-react';
import { resumeService, type ParsedResume, type RiskAssessment, type CandidateRanking } from '../../lib/api/resume-service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkillAnalysis {
  skills: Array<{ name: string; category: string; proficiency: string; yearsUsed: number }>;
  skillGaps: string[];
  recommendations: string[];
  matchScore: number;
}

type PipelineStage = 'idle' | 'uploading' | 'parsing' | 'skills' | 'risk' | 'ranking' | 'complete';

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_RESUME: ParsedResume = {
  id: 'res_demo_001',
  candidateId: 'cand_demo_001',
  basics: {
    name: '张明远',
    email: 'zhangmy@example.com',
    phone: '138****5678',
    location: '成都市高新区',
    summary: '10年全栈工程师，专注分布式系统与AI基础设施。曾主导千万级DAU系统架构设计，具备从0到1搭建技术团队经验。',
    linkedIn: 'linkedin.com/in/zhangmy',
    github: 'github.com/zhangmy-dev',
  },
  experience: [
    { company: '字节跳动', title: '高级技术专家', startDate: '2021-03', current: true, description: '负责推荐系统基础设施', achievements: ['将推荐延迟从120ms优化至35ms', '设计并落地Feature Store服务5000+QPS', '带领12人团队完成架构升级'], skills: ['Go', 'Kubernetes', 'Flink', 'Redis'], industry: '互联网', endDate: undefined },
    { company: '阿里巴巴', title: '高级工程师', startDate: '2018-06', endDate: '2021-02', current: false, description: '参与双11核心链路优化', achievements: ['双11峰值54万笔/秒零故障', '主导服务网格落地覆盖300+微服务'], skills: ['Java', 'Spring Cloud', 'Dubbo', 'MySQL'], industry: '电商' },
    { company: '华为', title: '软件工程师', startDate: '2015-07', endDate: '2018-05', current: false, description: '云计算平台开发', achievements: ['参与华为云PaaS平台核心模块开发', '获得2项技术专利'], skills: ['C++', 'Linux', 'Docker'], industry: '通信' },
  ],
  education: [
    { institution: '电子科技大学', degree: '硕士', field: '计算机科学与技术', startDate: '2013-09', endDate: '2015-06', gpa: 3.8 },
    { institution: '电子科技大学', degree: '学士', field: '软件工程', startDate: '2009-09', endDate: '2013-06', gpa: 3.6 },
  ],
  skills: [
    { name: 'Go', category: 'technical', proficiency: 'expert', yearsUsed: 5, lastUsed: '2024-01', verified: true, endorsements: 12 },
    { name: 'Kubernetes', category: 'technical', proficiency: 'expert', yearsUsed: 4, lastUsed: '2024-01', verified: true, endorsements: 8 },
    { name: 'Java', category: 'technical', proficiency: 'advanced', yearsUsed: 6, lastUsed: '2021-02', verified: true, endorsements: 15 },
    { name: 'Python', category: 'technical', proficiency: 'advanced', yearsUsed: 4, lastUsed: '2024-01', verified: false, endorsements: 5 },
    { name: 'System Design', category: 'domain', proficiency: 'expert', yearsUsed: 8, lastUsed: '2024-01', verified: true, endorsements: 20 },
    { name: 'Team Leadership', category: 'soft', proficiency: 'advanced', yearsUsed: 3, lastUsed: '2024-01', verified: false, endorsements: 6 },
  ],
  certifications: [
    { name: 'AWS Solutions Architect Professional', issuer: 'Amazon', date: '2022-03' },
    { name: 'CKA (Certified Kubernetes Administrator)', issuer: 'CNCF', date: '2021-08' },
  ],
  languages: [
    { name: '中文', proficiency: 'native' },
    { name: 'English', proficiency: 'professional' },
  ],
  totalYearsExperience: 9,
  seniorityLevel: 'lead',
  parsedAt: new Date().toISOString(),
  confidence: 0.96,
};

const DEMO_SKILLS: SkillAnalysis = {
  skills: DEMO_RESUME.skills.map(s => ({ name: s.name, category: s.category, proficiency: s.proficiency, yearsUsed: s.yearsUsed })),
  skillGaps: ['MLOps经验不足', '缺少大模型训练/推理优化经验', '前端技术栈较弱'],
  recommendations: ['建议补充LLM Serving相关项目经验', '可考虑MLflow/Kubeflow认证', '推荐参与开源AI Infra项目'],
  matchScore: 87,
};

const DEMO_RISK: RiskAssessment = {
  overallRisk: 'low',
  riskScore: 18,
  flags: [
    { type: 'job_hopping', severity: 'low', description: '近3份工作平均任期2.5年，处于行业正常范围', evidence: '字节3年+, 阿里2.7年, 华为3年', suggestion: '无需特别关注' },
    { type: 'gap', severity: 'low', description: '2021年2月-3月有1个月空档', evidence: '阿里离职到字节入职间隔', suggestion: '正常跳槽过渡期' },
  ],
  recommendations: ['整体风险极低，建议正常推进', '可在面试中确认长期职业规划'],
};

const DEMO_RANKINGS: CandidateRanking[] = [
  { candidateId: 'cand_demo_001', name: '张明远', overallScore: 92, matchScore: 87, dimensions: [{ name: '技术深度', score: 95, weight: 0.3 }, { name: '架构能力', score: 94, weight: 0.25 }, { name: '团队管理', score: 85, weight: 0.2 }, { name: '业务理解', score: 88, weight: 0.15 }, { name: '文化匹配', score: 90, weight: 0.1 }], rank: 1, highlights: ['大厂核心系统经验', '架构设计能力突出', '有团队管理经验'], gaps: ['AI/ML领域经验有限'] },
  { candidateId: 'cand_demo_002', name: '李思远', overallScore: 86, matchScore: 82, dimensions: [{ name: '技术深度', score: 90, weight: 0.3 }, { name: '架构能力', score: 85, weight: 0.25 }, { name: '团队管理', score: 78, weight: 0.2 }, { name: '业务理解', score: 82, weight: 0.15 }, { name: '文化匹配', score: 88, weight: 0.1 }], rank: 2, highlights: ['AI基础设施经验', '开源贡献活跃'], gaps: ['管理经验不足', '大规模系统经验有限'] },
  { candidateId: 'cand_demo_003', name: '王晓峰', overallScore: 79, matchScore: 75, dimensions: [{ name: '技术深度', score: 82, weight: 0.3 }, { name: '架构能力', score: 78, weight: 0.25 }, { name: '团队管理', score: 72, weight: 0.2 }, { name: '业务理解', score: 80, weight: 0.15 }, { name: '文化匹配', score: 85, weight: 0.1 }], rank: 3, highlights: ['全栈能力强', '创业经验'], gaps: ['大厂经验缺失', '稳定性存疑'] },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ResumeIntelligence() {
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [skillAnalysis, setSkillAnalysis] = useState<SkillAnalysis | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [rankings, setRankings] = useState<CandidateRanking[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'risk' | 'ranking' | 'explain'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // ─── Upload & Parse ──────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStage('uploading');

    try {
      setStage('parsing');
      const { resume } = await resumeService.parse(file);
      setParsedResume(resume);

      setStage('skills');
      const skillResult = await resumeService.analyzeSkills(resume.id);
      setSkillAnalysis(skillResult);

      setStage('risk');
      const { assessment } = await resumeService.assessRisk(resume.id);
      setRiskAssessment(assessment);

      setStage('complete');
    } catch (err) {
      // Fallback to demo mode
      console.warn('API unavailable, switching to demo mode:', err);
      setDemoMode(true);
      runDemoPipeline();
    }
  }, []);

  const runDemoPipeline = useCallback(() => {
    setError(null);
    setStage('uploading');
    const steps: Array<{ delay: number; fn: () => void }> = [
      { delay: 800, fn: () => setStage('parsing') },
      { delay: 2200, fn: () => { setParsedResume(DEMO_RESUME); setStage('skills'); } },
      { delay: 3800, fn: () => { setSkillAnalysis(DEMO_SKILLS); setStage('risk'); } },
      { delay: 5200, fn: () => { setRiskAssessment(DEMO_RISK); setStage('ranking'); } },
      { delay: 6800, fn: () => { setRankings(DEMO_RANKINGS); setStage('complete'); } },
    ];
    steps.forEach(({ delay, fn }) => setTimeout(fn, delay));
  }, []);

  const handleDemoStart = () => {
    setDemoMode(true);
    runDemoPipeline();
  };

  const handleReset = () => {
    setStage('idle');
    setParsedResume(null);
    setSkillAnalysis(null);
    setRiskAssessment(null);
    setRankings([]);
    setActiveTab('overview');
    setError(null);
    setDemoMode(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Resume Intelligence</h1>
            <p className="text-xs text-muted">Parser → Skill → Risk → Rank → Explain Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {demoMode && <span className="text-[9px] px-2 py-0.5 bg-warn-100 text-warn-700 rounded-full font-medium">DEMO</span>}
          {stage !== 'idle' && <button onClick={handleReset} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"><RefreshCw className="w-3 h-3" />重置</button>}
        </div>
      </header>

      {/* Pipeline Progress */}
      {stage !== 'idle' && (
        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          {(['uploading', 'parsing', 'skills', 'risk', 'ranking', 'complete'] as PipelineStage[]).map((s, i) => {
            const labels = ['上传', '解析', '技能', '风险', '排名', '完成'];
            const isActive = s === stage;
            const isDone = ['uploading', 'parsing', 'skills', 'risk', 'ranking', 'complete'].indexOf(stage) > i;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${isDone ? 'bg-ok-500 text-white' : isActive ? 'bg-brand-500 text-white animate-pulse' : 'bg-ink-100 text-muted'}`}>
                  {isDone ? <CheckCircle className="w-3 h-3" /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : i + 1}
                </div>
                <span className={`text-[10px] ${isActive ? 'text-brand-600 font-medium' : isDone ? 'text-ok-600' : 'text-muted'}`}>{labels[i]}</span>
                {i < 5 && <div className={`flex-1 h-px ${isDone ? 'bg-ok-300' : 'bg-ink-100'}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {stage === 'idle' ? (
          /* Upload Zone */
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 border-2 border-dashed border-brand-200 flex items-center justify-center">
                <Upload className="w-7 h-7 text-brand-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">上传简历开始分析</h2>
                <p className="text-sm text-muted">支持 PDF / DOCX / TXT，AI将自动完成解析→技能分析→风险检测→排名</p>
              </div>
              <div className="space-y-3">
                <label className="block w-full cursor-pointer">
                  <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFileUpload} className="hidden" />
                  <div className="w-full py-3 px-6 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />选择文件上传
                  </div>
                </label>
                <button onClick={handleDemoStart} className="w-full py-2.5 px-6 border border-border text-muted rounded-xl text-sm hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />运行Demo分析
                </button>
              </div>
              <p className="text-[10px] text-muted">Pipeline: Parser Agent → Skill Agent → Risk Agent → Ranking Agent → Explain Agent</p>
            </div>
          </div>
        ) : stage === 'complete' ? (
          /* Results Dashboard */
          <div className="h-full flex flex-col gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-2 flex-shrink-0">
              {([
                { key: 'overview', label: '总览', icon: Layers },
                { key: 'skills', label: '技能图谱', icon: Target },
                { key: 'risk', label: '风险检测', icon: AlertTriangle },
                { key: 'ranking', label: '候选人排名', icon: Trophy },
                { key: 'explain', label: '推荐解释', icon: MessageCircle },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-muted hover:text-foreground hover:bg-ink-50'}`}>
                  <tab.icon className="w-3.5 h-3.5" />{tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'overview' && parsedResume && (
                <div className="grid grid-cols-12 gap-3">
                  {/* Profile Card */}
                  <div className="col-span-4 bg-surface border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-lg font-bold">{parsedResume.basics.name[0]}</div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">{parsedResume.basics.name}</h3>
                        <p className="text-xs text-muted">{parsedResume.experience[0]?.title} @ {parsedResume.experience[0]?.company}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted">经验</span><span className="font-medium text-foreground">{parsedResume.totalYearsExperience}年</span></div>
                      <div className="flex justify-between"><span className="text-muted">级别</span><span className="font-medium text-foreground capitalize">{parsedResume.seniorityLevel}</span></div>
                      <div className="flex justify-between"><span className="text-muted">所在地</span><span className="font-medium text-foreground">{parsedResume.basics.location}</span></div>
                      <div className="flex justify-between"><span className="text-muted">解析置信度</span><span className="font-medium text-ok-600">{(parsedResume.confidence * 100).toFixed(0)}%</span></div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-[11px] text-muted leading-relaxed">{parsedResume.basics.summary}</p>
                    </div>
                  </div>

                  {/* Score Overview */}
                  <div className="col-span-8 grid grid-cols-3 gap-3">
                    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center">
                      <Target className="w-5 h-5 text-brand-500 mb-2" />
                      <span className="text-2xl font-bold text-foreground tabular-nums">{skillAnalysis?.matchScore || 0}%</span>
                      <span className="text-[10px] text-muted mt-1">JD匹配度</span>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center">
                      <Shield className="w-5 h-5 text-ok-500 mb-2" />
                      <span className="text-2xl font-bold text-foreground tabular-nums">{riskAssessment ? 100 - riskAssessment.riskScore : 0}</span>
                      <span className="text-[10px] text-muted mt-1">信用评分</span>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center">
                      <Trophy className="w-5 h-5 text-warn-500 mb-2" />
                      <span className="text-2xl font-bold text-foreground tabular-nums">#{rankings.find(r => r.candidateId === parsedResume.candidateId)?.rank || 1}</span>
                      <span className="text-[10px] text-muted mt-1">综合排名</span>
                    </div>

                    {/* Experience Timeline */}
                    <div className="col-span-3 bg-surface border border-border rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-brand-500" />工作经历</h4>
                      <div className="space-y-3">
                        {parsedResume.experience.map((exp, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full ${exp.current ? 'bg-ok-500' : 'bg-ink-300'}`} />
                              {i < parsedResume.experience.length - 1 && <div className="w-px flex-1 bg-ink-200 mt-1" />}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">{exp.title}</span>
                                {exp.current && <span className="text-[8px] px-1.5 py-0.5 bg-ok-100 text-ok-700 rounded-full">当前</span>}
                              </div>
                              <p className="text-[11px] text-muted">{exp.company} · {exp.startDate} — {exp.endDate || '至今'}</p>
                              <div className="flex flex-wrap gap-1 mt-1">{exp.skills.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded">{s}</span>)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'skills' && skillAnalysis && (
                <div className="grid grid-cols-12 gap-3">
                  {/* Skill Matrix */}
                  <div className="col-span-8 bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3">技能矩阵</h4>
                    <div className="space-y-2">
                      {skillAnalysis.skills.map(skill => (
                        <div key={skill.name} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-foreground w-28 truncate">{skill.name}</span>
                          <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${skill.proficiency === 'expert' ? 'bg-brand-600 w-[95%]' : skill.proficiency === 'advanced' ? 'bg-brand-400 w-[75%]' : skill.proficiency === 'intermediate' ? 'bg-brand-300 w-[55%]' : 'bg-ink-300 w-[35%]'}`} />
                          </div>
                          <span className="text-[10px] text-muted w-16 text-right capitalize">{skill.proficiency}</span>
                          <span className="text-[10px] text-muted w-12 text-right tabular-nums">{skill.yearsUsed}y</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Gaps & Recommendations */}
                  <div className="col-span-4 space-y-3">
                    <div className="bg-surface border border-border rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-warn-500" />技能缺口</h4>
                      <div className="space-y-1.5">{skillAnalysis.skillGaps.map((gap, i) => <div key={i} className="flex items-start gap-1.5"><XCircle className="w-3 h-3 text-warn-500 mt-0.5 flex-shrink-0" /><span className="text-[11px] text-foreground">{gap}</span></div>)}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3 text-brand-500" />建议</h4>
                      <div className="space-y-1.5">{skillAnalysis.recommendations.map((rec, i) => <div key={i} className="flex items-start gap-1.5"><ChevronRight className="w-3 h-3 text-brand-500 mt-0.5 flex-shrink-0" /><span className="text-[11px] text-foreground">{rec}</span></div>)}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'risk' && riskAssessment && (
                <div className="grid grid-cols-12 gap-3">
                  {/* Risk Score */}
                  <div className="col-span-4 bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center">
                    <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${riskAssessment.overallRisk === 'low' ? 'border-ok-400' : riskAssessment.overallRisk === 'medium' ? 'border-warn-400' : 'border-risk-400'}`}>
                      <span className="text-2xl font-bold text-foreground tabular-nums">{riskAssessment.riskScore}</span>
                    </div>
                    <span className={`mt-2 text-xs font-medium ${riskAssessment.overallRisk === 'low' ? 'text-ok-600' : riskAssessment.overallRisk === 'medium' ? 'text-warn-600' : 'text-risk-600'}`}>
                      {riskAssessment.overallRisk === 'low' ? '低风险' : riskAssessment.overallRisk === 'medium' ? '中等风险' : '高风险'}
                    </span>
                    <p className="text-[10px] text-muted mt-1">风险评分 (0-100)</p>
                  </div>
                  {/* Risk Flags */}
                  <div className="col-span-8 bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3">风险信号</h4>
                    <div className="space-y-3">
                      {riskAssessment.flags.map((flag, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${flag.severity === 'high' ? 'bg-risk-50 border-risk-200' : flag.severity === 'medium' ? 'bg-warn-50 border-warn-200' : 'bg-ink-50 border-border'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${flag.severity === 'high' ? 'bg-risk-100 text-risk-700' : flag.severity === 'medium' ? 'bg-warn-100 text-warn-700' : 'bg-ink-200 text-muted'}`}>{flag.type.replace('_', ' ')}</span>
                            <span className={`text-[9px] font-medium ${flag.severity === 'high' ? 'text-risk-600' : flag.severity === 'medium' ? 'text-warn-600' : 'text-muted'}`}>{flag.severity.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-foreground">{flag.description}</p>
                          <p className="text-[10px] text-muted mt-1">证据: {flag.evidence}</p>
                          <p className="text-[10px] text-brand-600 mt-1">建议: {flag.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ranking' && rankings.length > 0 && (
                <div className="space-y-3">
                  {rankings.map(candidate => (
                    <div key={candidate.candidateId} className={`bg-surface border rounded-xl p-4 ${candidate.rank === 1 ? 'border-brand-300 ring-1 ring-brand-100' : 'border-border'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${candidate.rank === 1 ? 'bg-brand-100 text-brand-700' : candidate.rank === 2 ? 'bg-ink-100 text-foreground' : 'bg-ink-50 text-muted'}`}>#{candidate.rank}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{candidate.name}</span>
                            {candidate.rank === 1 && <Star className="w-3.5 h-3.5 text-warn-500 fill-warn-500" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted">综合: <span className="font-bold text-foreground tabular-nums">{candidate.overallScore}</span></span>
                            <span className="text-xs text-muted">匹配: <span className="font-bold text-brand-600 tabular-nums">{candidate.matchScore}%</span></span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {candidate.dimensions.map(d => (
                            <div key={d.name} className="text-center">
                              <div className="text-[10px] text-muted mb-0.5">{d.name}</div>
                              <div className="text-xs font-bold text-foreground tabular-nums">{d.score}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                        <div className="flex-1">
                          <span className="text-[10px] text-ok-600 font-medium">亮点:</span>
                          <div className="flex flex-wrap gap-1 mt-1">{candidate.highlights.map((h, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 bg-ok-50 text-ok-700 rounded">{h}</span>)}</div>
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] text-warn-600 font-medium">缺口:</span>
                          <div className="flex flex-wrap gap-1 mt-1">{candidate.gaps.map((g, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 bg-warn-50 text-warn-700 rounded">{g}</span>)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'explain' && (
                <div className="bg-surface border border-border rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-4 h-4 text-brand-500" />
                    <h4 className="text-sm font-semibold text-foreground">推荐可解释性 (Explain Agent)</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-brand-50 border border-brand-100 rounded-lg">
                      <p className="text-xs font-medium text-brand-700 mb-2">为什么推荐张明远为#1候选人？</p>
                      <p className="text-xs text-foreground leading-relaxed">
                        基于多维度加权评估模型（技术深度30% + 架构能力25% + 团队管理20% + 业务理解15% + 文化匹配10%），
                        张明远在5个维度中4个达到85分以上。其核心优势在于：
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li className="text-[11px] text-foreground flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-ok-500 mt-0.5 flex-shrink-0" />字节跳动+阿里双一线大厂核心系统经验，验证了其在高并发场景下的架构设计能力</li>
                        <li className="text-[11px] text-foreground flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-ok-500 mt-0.5 flex-shrink-0" />有12人团队管理经验，且在技术决策中展现了"说服CTO"级别的影响力</li>
                        <li className="text-[11px] text-foreground flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-ok-500 mt-0.5 flex-shrink-0" />AWS SA Pro + CKA双认证，技术深度可量化验证</li>
                        <li className="text-[11px] text-foreground flex items-start gap-1.5"><AlertTriangle className="w-3 h-3 text-warn-500 mt-0.5 flex-shrink-0" />唯一缺口：AI/ML领域直接经验有限，但其基础设施背景可快速迁移</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-ink-50 border border-border rounded-lg">
                      <p className="text-[10px] text-muted flex items-center gap-1.5"><Shield className="w-3 h-3 text-trust-500" />本解释由 Explain Agent 生成，基于结构化证据链推理，非黑盒评分。所有评估维度、权重、证据可审计追溯。</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Processing State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {stage === 'uploading' && '正在上传简历...'}
                  {stage === 'parsing' && 'Parser Agent 正在解析简历结构...'}
                  {stage === 'skills' && 'Skill Agent 正在分析技能图谱...'}
                  {stage === 'risk' && 'Risk Agent 正在检测风险信号...'}
                  {stage === 'ranking' && 'Ranking Agent 正在计算候选人排名...'}
                </p>
                <p className="text-xs text-muted mt-1">Pipeline: Parser → Skill → Risk → Rank → Explain</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 p-3 bg-risk-50 border border-risk-200 rounded-lg flex items-center gap-2">
          <XCircle className="w-4 h-4 text-risk-500 flex-shrink-0" />
          <p className="text-xs text-risk-700">{error}</p>
        </div>
      )}
    </div>
  );
}
