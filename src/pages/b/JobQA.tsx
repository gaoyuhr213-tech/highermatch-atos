import { useState } from 'react';
import { MessageSquare, Shield, CheckCircle, ThumbsUp, Eye, Send, Building2, DollarSign, Clock, Users, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CABadge from '../../components/CABadge';

interface JobQAItem {
  id: string;
  question: string;
  answer: string;
  author: string;
  authorRole: string;
  timestamp: string;
  likes: number;
  views: number;
  verified: boolean;
  category: 'work_content' | 'salary' | 'culture' | 'growth' | 'team';
}

interface JobPost {
  id: string;
  title: string;
  company: string;
  caVerified: boolean;
  salary: string;
  location: string;
  qaCount: number;
  items: JobQAItem[];
}

const mockJobPosts: JobPost[] = [
  {
    id: 'J-001', title: '高级算法工程师', company: '蜀道集团', caVerified: true,
    salary: '35-50K·15薪', location: '成都·高新区', qaCount: 12,
    items: [
      { id: 'Q-001', question: '这个岗位日常工作内容是什么？加班多吗？', answer: '主要负责推荐系统算法优化，日常工作包括模型训练、A/B实验设计和效果分析。我们团队实行弹性工作制，核心时间10:00-17:00，平均每周加班不超过5小时。项目冲刺期可能会多一些，但会有调休补偿。', author: '张经理', authorRole: '直属Leader', timestamp: '2024-03-10', likes: 45, views: 320, verified: true, category: 'work_content' },
      { id: 'Q-002', question: '薪资结构具体是怎样的？', answer: '基本薪资占80%，绩效奖金占20%。年终奖根据公司和个人绩效，通常2-4个月。另有项目奖金和专利奖励。五险一金按实际薪资全额缴纳，补充商业保险。', author: '李HR', authorRole: 'HRBP', timestamp: '2024-03-11', likes: 67, views: 450, verified: true, category: 'salary' },
      { id: 'Q-003', question: '团队氛围怎么样？技术栈是什么？', answer: '团队15人，平均年龄28岁，技术氛围浓厚。每周有技术分享会，鼓励开源贡献。技术栈：Python + PyTorch + Ray + K8s，正在引入大模型能力。', author: '陈工', authorRole: '在职员工', timestamp: '2024-03-12', likes: 38, views: 280, verified: true, category: 'team' },
    ]
  },
  {
    id: 'J-002', title: '前端架构师', company: '川投集团', caVerified: true,
    salary: '40-60K·14薪', location: '成都·天府新区', qaCount: 8,
    items: [
      { id: 'Q-004', question: '前端团队规模和技术方向？', answer: '前端团队20+人，分为基础架构组和业务组。架构师主要负责微前端体系建设、组件库维护和性能优化。技术栈以React + TypeScript为主，正在推进SSR和边缘计算。', author: '王总监', authorRole: '技术总监', timestamp: '2024-03-09', likes: 52, views: 380, verified: true, category: 'work_content' },
      { id: 'Q-005', question: '晋升路径清晰吗？', answer: '技术序列：P6→P7→P8→P9，每级有明确的能力要求和评审标准。架构师入职定级P7，表现优秀1-2年可评P8。管理序列也可转换，不强制。', author: '赵HR', authorRole: 'HRBP', timestamp: '2024-03-10', likes: 41, views: 290, verified: true, category: 'growth' },
    ]
  },
];

const categoryConfig: Record<string, { label: string; icon: typeof Building2; color: string }> = {
  work_content: { label: '工作内容', icon: Building2, color: 'text-brand-600 bg-brand-50' },
  salary: { label: '薪资福利', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  culture: { label: '企业文化', icon: Star, color: 'text-amber-600 bg-amber-50' },
  growth: { label: '成长发展', icon: Clock, color: 'text-violet-600 bg-violet-50' },
  team: { label: '团队氛围', icon: Users, color: 'text-sky-600 bg-sky-50' },
};

export default function JobQA() {
  const [selectedJob, setSelectedJob] = useState<JobPost>(mockJobPosts[0]);
  const [newQuestion, setNewQuestion] = useState('');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">岗位真实答疑</h1>
          <p className="text-sm text-muted mt-1">CA认证企业发布真实工作内容 · 消除信息差 · 提升到面率</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200">
            <span className="text-xs font-semibold text-trust-700">仅CA认证企业可发布</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 岗位列表 */}
        <div className="col-span-4 space-y-3">
          <div className="bg-surface rounded-xl border border-border/80 shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">认证岗位列表</h3>
            <div className="space-y-2">
              {mockJobPosts.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedJob.id === job.id
                      ? 'bg-brand-50 border border-brand-200 shadow-sm'
                      : 'hover:bg-ink-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{job.title}</span>
                        {job.caVerified && <CABadge size="sm" />}
                      </div>
                      <p className="text-xs text-muted mt-1">{job.company} · {job.location}</p>
                      <p className="text-xs font-semibold text-brand-600 mt-1">{job.salary}</p>
                    </div>
                    <span className="text-[10px] text-muted">{job.qaCount}条答疑</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 答疑详情 */}
        <div className="col-span-8 space-y-4">
          {/* 岗位信息头 */}
          <div className="bg-surface rounded-xl border border-border/80 shadow-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-foreground">{selectedJob.title}</h2>
                  <CABadge size="md" />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-sm text-muted">{selectedJob.company}</span>
                  <span className="text-sm text-muted">|</span>
                  <span className="text-sm text-muted">{selectedJob.location}</span>
                  <span className="text-sm text-muted">|</span>
                  <span className="text-sm font-semibold text-brand-600">{selectedJob.salary}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedJob.qaCount}</p>
                  <p className="text-[10px] text-muted">条真实答疑</p>
                </div>
              </div>
            </div>
          </div>

          {/* 答疑列表 */}
          <div className="space-y-3">
            <AnimatePresence>
              {selectedJob.items.map((item, index) => {
                const cat = categoryConfig[item.category];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-surface rounded-xl border border-border/80 shadow-card p-5 hover:shadow-card-hover transition-shadow"
                  >
                    {/* 问题 */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MessageSquare className="w-3 h-3 text-muted" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{item.question}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${cat.color}`}>
                            <cat.icon className="w-3 h-3" />
                            {cat.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 回答 */}
                    <div className="mt-4 ml-9 p-4 bg-ink-50 rounded-xl border border-border">
                      <p className="text-sm text-foreground leading-relaxed">{item.answer}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-brand-700">{item.author[0]}</span>
                            </div>
                            <span className="text-xs font-medium text-foreground">{item.author}</span>
                            <span className="text-[10px] text-muted">{item.authorRole}</span>
                          </div>
                          {item.verified && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-trust-600">
                              <CheckCircle className="w-3 h-3" />
                              已验证
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-muted">
                          <span className="flex items-center gap-1 text-[10px]">
                            <ThumbsUp className="w-3 h-3" />{item.likes}
                          </span>
                          <span className="flex items-center gap-1 text-[10px]">
                            <Eye className="w-3 h-3" />{item.views}
                          </span>
                          <span className="text-[10px]">{item.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* 提问输入框 */}
          <div className="bg-surface rounded-xl border border-border/80 shadow-card p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="向认证企业提问真实工作情况..."
                className="flex-1 px-4 py-2.5 bg-ink-50 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
              />
              <button className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm">
                <Send className="w-4 h-4" />
                <span>提问</span>
              </button>
            </div>
            <p className="text-[10px] text-muted mt-2 ml-1">提问内容经审核后发布 · 仅CA认证企业可回答 · 实名理性社区</p>
          </div>
        </div>
      </div>
    </div>
  );
}
