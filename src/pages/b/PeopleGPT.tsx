/**
 * 蓉才通™ ATOS — PeopleGPT
 * 
 * 对标: LinkedIn Recruiter × Eightfold × HireEZ
 * 
 * 真实能力:
 * - 自然语言人才搜索（NL → Structured Query → Hybrid Search）
 * - Ranking Agent 多维度排序
 * - Outreach Agent 外联策略生成
 * - Email Generator 个性化邮件
 * - Talent Graph 关系网络
 * - 连接 /api/v2/people/* 后端Pipeline
 */
import { useState, useCallback, useRef } from 'react';
import {
  Search, Users, Send, Mail, Loader2, Star, MapPin, Briefcase,
  Building2, GraduationCap, ChevronRight, Filter, Download,
  MessageSquare, Sparkles, Globe, Link2, Clock, TrendingUp,
  CheckCircle, XCircle, Copy, ExternalLink, Zap, Target
} from 'lucide-react';
import { peopleService } from '../../lib/api/people-service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TalentProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  experience: number;
  skills: string[];
  matchScore: number;
  reachability: 'high' | 'medium' | 'low';
  highlights: string[];
  education: string;
  linkedIn?: string;
  github?: string;
  lastActive: string;
  openToWork: boolean;
}

interface OutreachEmail {
  subject: string;
  body: string;
  tone: string;
  personalization: string[];
}

type SearchMode = 'idle' | 'searching' | 'results' | 'outreach';

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_RESULTS: TalentProfile[] = [
  { id: 'p1', name: '陈思远', title: '高级算法工程师', company: '商汤科技', location: '成都', experience: 6, skills: ['PyTorch', 'Transformer', 'CV', 'MLOps', 'CUDA'], matchScore: 94, reachability: 'high', highlights: ['CVPR 2023一作', '大模型训练经验', 'A100集群调优'], education: '清华大学 计算机博士', linkedIn: 'linkedin.com/in/chensiyuan', github: 'github.com/siyuan-cv', lastActive: '2天前', openToWork: true },
  { id: 'p2', name: '刘雨桐', title: 'AI Infra Lead', company: '字节跳动', location: '北京', experience: 8, skills: ['Go', 'Kubernetes', 'Ray', 'Triton', 'vLLM'], matchScore: 91, reachability: 'medium', highlights: ['千卡集群调度', '推理延迟优化60%', '团队15人'], education: '北京大学 计算机硕士', linkedIn: 'linkedin.com/in/liuyutong', lastActive: '1周前', openToWork: false },
  { id: 'p3', name: '王浩然', title: 'NLP Research Scientist', company: '百度', location: '深圳', experience: 5, skills: ['LLM', 'RLHF', 'RAG', 'Python', 'Prompt Engineering'], matchScore: 88, reachability: 'high', highlights: ['文心一言核心成员', 'RLHF实战经验', '3篇ACL'], education: '中科院 NLP方向博士', github: 'github.com/wanghr-nlp', lastActive: '3天前', openToWork: true },
  { id: 'p4', name: '张晓雯', title: 'ML Platform Engineer', company: '蚂蚁集团', location: '杭州', experience: 4, skills: ['Spark', 'Feature Store', 'Airflow', 'Python', 'SQL'], matchScore: 82, reachability: 'low', highlights: ['Feature Store从0到1', '日处理10TB+', '平台化思维强'], education: '浙江大学 数据科学硕士', lastActive: '2周前', openToWork: false },
  { id: 'p5', name: '赵明轩', title: 'Senior SRE / MLOps', company: '快手', location: '成都', experience: 7, skills: ['Kubernetes', 'Prometheus', 'Terraform', 'Python', 'GPU Scheduling'], matchScore: 79, reachability: 'high', highlights: ['GPU利用率提升40%', 'MLOps标准化', '成本优化500万/年'], education: '电子科技大学 软件工程硕士', linkedIn: 'linkedin.com/in/zhaomx', lastActive: '今天', openToWork: true },
];

const DEMO_EMAIL: OutreachEmail = {
  subject: '陈思远老师，关于AI基础设施架构师机会的探讨',
  body: `陈思远老师您好，

我是蓉才通的AI人才顾问。注意到您在商汤科技的CV大模型训练工作，特别是CVPR 2023的一作论文和A100集群调优经验，与我们正在寻找的AI基础设施架构师角色高度匹配。

这个角色的核心挑战：
• 搭建千卡级GPU训练集群的调度与优化体系
• 设计多模态大模型的训练Pipeline（从数据到部署）
• 带领5-8人的AI Infra团队

薪资范围：80-120万/年 + 期权，base成都。

如果您对此感兴趣，方便这周安排一次30分钟的电话沟通吗？

祝好，
蓉才通 AI Talent Team`,
  tone: '专业但不生硬，突出技术共鸣',
  personalization: ['引用CVPR论文', '提及A100经验', '强调技术挑战而非薪资', '成都base降低迁移成本'],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PeopleGPT() {
  const [mode, setMode] = useState<SearchMode>('idle');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TalentProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<TalentProfile | null>(null);
  const [outreachEmail, setOutreachEmail] = useState<OutreachEmail | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setMode('searching');
    setSelectedProfile(null);
    setOutreachEmail(null);

    try {
      const response = await peopleService.search(query);
      setResults(response.results);
      setMode('results');
    } catch {
      // Fallback to demo
      setDemoMode(true);
      setTimeout(() => {
        setResults(DEMO_RESULTS);
        setMode('results');
      }, 2000);
    }
  }, [query]);

  const handleGenerateOutreach = useCallback(async (profile: TalentProfile) => {
    setSelectedProfile(profile);
    setEmailLoading(true);
    setMode('outreach');

    try {
      const response = await peopleService.generateOutreach(profile.id, query);
      setOutreachEmail(response.email);
    } catch {
      setDemoMode(true);
      setTimeout(() => {
        setOutreachEmail(DEMO_EMAIL);
        setEmailLoading(false);
      }, 2500);
      return;
    }
    setEmailLoading(false);
  }, [query]);

  const handleCopyEmail = () => {
    if (outreachEmail) {
      navigator.clipboard.writeText(`Subject: ${outreachEmail.subject}\n\n${outreachEmail.body}`);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">PeopleGPT</h1>
            <p className="text-xs text-muted">自然语言人才搜索 → 排名 → 外联 → 邮件生成</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {demoMode && <span className="text-[9px] px-2 py-0.5 bg-warn-100 text-warn-700 rounded-full font-medium">DEMO</span>}
          {results.length > 0 && <span className="text-xs text-muted">{results.length} 位候选人</span>}
        </div>
      </header>

      {/* Search Bar */}
      <div className="flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="用自然语言描述你要找的人才，例如：成都的AI Infra工程师，5年以上经验，熟悉GPU集群调度..."
            className="w-full pl-10 pr-24 py-3 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || mode === 'searching'}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {mode === 'searching' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            搜索
          </button>
        </div>
        {mode === 'idle' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted">热门搜索:</span>
            {['成都 AI算法 5年+', '全栈架构师 大厂背景', 'NLP工程师 LLM经验', 'DevOps SRE 成都'].map(q => (
              <button key={q} onClick={() => { setQuery(q); }} className="text-[10px] px-2 py-0.5 bg-ink-50 text-muted rounded-full hover:bg-brand-50 hover:text-brand-600 transition-colors">{q}</button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {mode === 'idle' ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center">
                <Globe className="w-7 h-7 text-violet-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">AI驱动的人才搜索</h2>
                <p className="text-xs text-muted leading-relaxed">
                  输入自然语言描述，PeopleGPT将自动理解意图，在人才图谱中进行语义搜索+关键词匹配，
                  并按多维度排名返回最匹配的候选人。
                </p>
              </div>
              <div className="text-[10px] text-muted space-y-1">
                <p>Pipeline: NL Parse → Query Expand → Hybrid Search → Ranking → Outreach</p>
                <p>支持: 技能/经验/地域/公司/学历/薪资等多维度组合搜索</p>
              </div>
            </div>
          </div>
        ) : mode === 'searching' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
              <p className="text-sm text-foreground font-medium">Search Agent 正在理解搜索意图...</p>
              <p className="text-xs text-muted">NL → Structured Query → Hybrid Search → Ranking</p>
            </div>
          </div>
        ) : (
          <>
            {/* Results List */}
            <div className="w-[420px] flex-shrink-0 overflow-y-auto space-y-2 pr-1">
              {results.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfile(profile)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedProfile?.id === profile.id ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-100' : 'border-border bg-surface hover:border-brand-200 hover:bg-ink-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{profile.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{profile.name}</span>
                        {profile.openToWork && <span className="text-[8px] px-1 py-0.5 bg-ok-100 text-ok-700 rounded-full">Open</span>}
                        <span className="ml-auto text-xs font-bold text-brand-600 tabular-nums">{profile.matchScore}%</span>
                      </div>
                      <p className="text-[11px] text-muted truncate">{profile.title} @ {profile.company}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{profile.location}</span>
                        <span className="text-[10px] text-muted flex items-center gap-0.5"><Briefcase className="w-2.5 h-2.5" />{profile.experience}年</span>
                        <span className={`text-[10px] flex items-center gap-0.5 ${profile.reachability === 'high' ? 'text-ok-600' : profile.reachability === 'medium' ? 'text-warn-600' : 'text-muted'}`}>
                          <Target className="w-2.5 h-2.5" />{profile.reachability === 'high' ? '高可达' : profile.reachability === 'medium' ? '中可达' : '低可达'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">{profile.skills.slice(0, 4).map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded">{s}</span>)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail Panel */}
            <div className="flex-1 overflow-y-auto">
              {selectedProfile ? (
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  {/* Profile Header */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold">{selectedProfile.name[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">{selectedProfile.name}</h3>
                        {selectedProfile.openToWork && <span className="text-[9px] px-1.5 py-0.5 bg-ok-100 text-ok-700 rounded-full font-medium">Open to Work</span>}
                      </div>
                      <p className="text-xs text-muted">{selectedProfile.title} @ {selectedProfile.company}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-muted flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedProfile.location}</span>
                        <span className="text-[11px] text-muted flex items-center gap-1"><Briefcase className="w-3 h-3" />{selectedProfile.experience}年经验</span>
                        <span className="text-[11px] text-muted flex items-center gap-1"><GraduationCap className="w-3 h-3" />{selectedProfile.education}</span>
                        <span className="text-[11px] text-muted flex items-center gap-1"><Clock className="w-3 h-3" />{selectedProfile.lastActive}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-600 tabular-nums">{selectedProfile.matchScore}%</div>
                      <div className="text-[9px] text-muted">匹配度</div>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Star className="w-3 h-3 text-warn-500" />核心亮点</h4>
                    <div className="space-y-1">{selectedProfile.highlights.map((h, i) => <div key={i} className="flex items-center gap-1.5 text-xs text-foreground"><CheckCircle className="w-3 h-3 text-ok-500 flex-shrink-0" />{h}</div>)}</div>
                  </div>

                  {/* Skills */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">技能标签</h4>
                    <div className="flex flex-wrap gap-1.5">{selectedProfile.skills.map(s => <span key={s} className="text-[10px] px-2 py-1 bg-violet-50 text-violet-700 rounded-lg border border-violet-100">{s}</span>)}</div>
                  </div>

                  {/* Social Links */}
                  <div className="flex items-center gap-3">
                    {selectedProfile.linkedIn && <a href="#" className="text-[11px] text-brand-600 flex items-center gap-1 hover:underline"><Link2 className="w-3 h-3" />LinkedIn</a>}
                    {selectedProfile.github && <a href="#" className="text-[11px] text-brand-600 flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />GitHub</a>}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <button
                      onClick={() => handleGenerateOutreach(selectedProfile)}
                      className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />生成外联邮件
                    </button>
                    <button className="px-4 py-2.5 border border-border text-muted rounded-lg text-xs hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" />加入Pipeline
                    </button>
                  </div>

                  {/* Outreach Email */}
                  {mode === 'outreach' && selectedProfile && (
                    <div className="mt-4 p-4 bg-ink-50 border border-border rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-violet-500" />AI生成外联邮件</h4>
                        {outreachEmail && <button onClick={handleCopyEmail} className="text-[10px] text-brand-600 flex items-center gap-1 hover:underline"><Copy className="w-3 h-3" />复制</button>}
                      </div>
                      {emailLoading ? (
                        <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-violet-500" /><span className="text-xs text-muted">Outreach Agent 正在生成个性化邮件...</span></div>
                      ) : outreachEmail ? (
                        <div className="space-y-3">
                          <div><span className="text-[10px] text-muted">主题:</span><p className="text-xs font-medium text-foreground mt-0.5">{outreachEmail.subject}</p></div>
                          <div><span className="text-[10px] text-muted">正文:</span><pre className="text-[11px] text-foreground mt-1 whitespace-pre-wrap leading-relaxed font-sans">{outreachEmail.body}</pre></div>
                          <div className="flex items-center gap-3 pt-2 border-t border-border">
                            <span className="text-[10px] text-muted">语调: {outreachEmail.tone}</span>
                            <div className="flex gap-1">{outreachEmail.personalization.map((p, i) => <span key={i} className="text-[8px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">{p}</span>)}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">点击左侧候选人查看详情</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
