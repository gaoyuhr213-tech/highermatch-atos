export type UserRole = 'employer' | 'candidate' | 'expert' | 'soe';

export interface DecisionProposal {
  id: string; type: 'Hire' | 'Promote' | 'Transfer' | 'Upskill' | 'Retain' | 'Replace';
  candidate: string; position: string; confidence: number; riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected'; timestamp: string; evidenceCount: number;
  lineageHash: string; modelVersion: string; promptVersion: string;
}

export interface PipelineCandidate {
  id: string; name: string; avatar: string; position: string;
  stage: 'sourcing' | 'screening' | 'interviewing' | 'risk_check' | 'offering' | 'signed';
  matchScore: number; riskScore: number; tags: string[]; appliedDate: string; suspendGate?: string;
}

export interface GraphNode { id: string; name: string; type: 'talent' | 'company' | 'skill' | 'position'; x: number; y: number; connections: number; caVerified: boolean; }
export interface GraphEdge { source: string; target: string; type: string; caSigned: boolean; weight: number; }
export interface SourcingResult { id: string; name: string; currentRole: string; company: string; matchScore: number; skills: string[]; source: string; reachable: boolean; contacted: boolean; }
export interface InterviewSession { id: string; candidate: string; position: string; status: 'scheduled' | 'in_progress' | 'completed' | 'scored'; startTime: string; duration: number; hardSkillScore: number; softSkillScore: number; authenticityScore: number; dynamicQuestions: number; transcript: ChatMessage[]; }
export interface ChatMessage { role: 'ai' | 'candidate' | 'system'; content: string; timestamp: string; evidenceLink?: string; }
export interface EndorsementCard { id: string; candidate: string; position: string; issuer: string; status: 'generated' | 'signed' | 'shared' | 'verified' | 'converted'; caSignature: string; sm3Hash: string; shareUrl: string; createdAt: string; verifiedCount: number; }
export interface ExpertReview { id: string; candidate: string; position: string; domain: string; deadline: string; status: 'pending' | 'in_progress' | 'completed'; reward: number; anonymized: boolean; }
export interface SuccessionSlot { id: string; position: string; incumbent: string; readiness: 'ready_now' | 'ready_1yr' | 'ready_2yr'; candidates: { name: string; score: number; gap: string }[]; riskLevel: 'low' | 'medium' | 'high'; }
export interface DecisionLineageStep { id: string; phase: string; action: string; actor: string; timestamp: string; evidenceLinks: { type: string; source: string; confidence: number }[]; counterEvidence?: { type: string; source: string; note: string }[]; modelVersion?: string; promptVersion?: string; sm3Hash: string; caSignature?: string; }
export interface SSEEvent { id: string; type: string; title: string; description: string; timestamp: string; priority: 'high' | 'medium' | 'low'; }

export const decisionProposals: DecisionProposal[] = [
  { id: 'D-001', type: 'Hire', candidate: '张明远', position: '高级算法工程师', confidence: 92, riskLevel: 'low', status: 'pending', timestamp: '2024-03-15 09:30', evidenceCount: 14, lineageHash: 'a3f2c8...e91b', modelVersion: 'v2.3.1', promptVersion: 'hire-eval-v4' },
  { id: 'D-002', type: 'Promote', candidate: '李思涵', position: '技术总监', confidence: 87, riskLevel: 'medium', status: 'pending', timestamp: '2024-03-15 10:15', evidenceCount: 22, lineageHash: 'b7d1a4...f03c', modelVersion: 'v2.3.1', promptVersion: 'promote-eval-v3' },
  { id: 'D-003', type: 'Transfer', candidate: '王建国', position: '成都研发中心负责人', confidence: 78, riskLevel: 'medium', status: 'pending', timestamp: '2024-03-15 11:00', evidenceCount: 9, lineageHash: 'c4e9b2...d17a', modelVersion: 'v2.3.1', promptVersion: 'transfer-eval-v2' },
  { id: 'D-004', type: 'Retain', candidate: '陈雅琪', position: '首席数据科学家', confidence: 95, riskLevel: 'high', status: 'pending', timestamp: '2024-03-15 14:20', evidenceCount: 18, lineageHash: 'd8f3c1...a42e', modelVersion: 'v2.3.1', promptVersion: 'retain-eval-v3' },
  { id: 'D-005', type: 'Hire', candidate: '刘浩然', position: 'DevOps架构师', confidence: 89, riskLevel: 'low', status: 'approved', timestamp: '2024-03-14 16:45', evidenceCount: 11, lineageHash: 'e2a7d5...b89f', modelVersion: 'v2.3.0', promptVersion: 'hire-eval-v4' },
];

export const pipelineCandidates: PipelineCandidate[] = [
  { id: 'C-001', name: '张明远', avatar: 'ZM', position: '高级算法工程师', stage: 'offering', matchScore: 92, riskScore: 12, tags: ['Python', 'ML', 'NLP'], appliedDate: '2024-03-01' },
  { id: 'C-002', name: '李思涵', avatar: 'LS', position: '前端架构师', stage: 'interviewing', matchScore: 88, riskScore: 8, tags: ['React', 'TypeScript', 'WebGL'], appliedDate: '2024-03-03' },
  { id: 'C-003', name: '王建国', avatar: 'WJ', position: '后端负责人', stage: 'screening', matchScore: 76, riskScore: 25, tags: ['Go', 'K8s', 'Distributed'], appliedDate: '2024-03-05', suspendGate: '匹配度低于阈值' },
  { id: 'C-004', name: '陈雅琪', avatar: 'CY', position: '数据科学家', stage: 'risk_check', matchScore: 94, riskScore: 45, tags: ['PyTorch', 'CV', 'MLOps'], appliedDate: '2024-03-02', suspendGate: '风险置信度不足' },
  { id: 'C-005', name: '刘浩然', avatar: 'LH', position: 'DevOps架构师', stage: 'signed', matchScore: 89, riskScore: 5, tags: ['AWS', 'Terraform', 'CI/CD'], appliedDate: '2024-02-28' },
  { id: 'C-006', name: '赵晓峰', avatar: 'ZX', position: '产品经理', stage: 'sourcing', matchScore: 72, riskScore: 15, tags: ['B2B', 'SaaS', 'Strategy'], appliedDate: '2024-03-10' },
  { id: 'C-007', name: '孙婷婷', avatar: 'ST', position: 'UI/UX设计师', stage: 'screening', matchScore: 85, riskScore: 10, tags: ['Figma', 'Motion', 'DS'], appliedDate: '2024-03-08' },
  { id: 'C-008', name: '周伟明', avatar: 'ZW', position: '安全工程师', stage: 'interviewing', matchScore: 91, riskScore: 18, tags: ['Pentest', 'SM2/SM3', 'Zero Trust'], appliedDate: '2024-03-04' },
];

export const graphNodes: GraphNode[] = [
  { id: 'n1', name: '张明远', type: 'talent', x: 400, y: 300, connections: 12, caVerified: true },
  { id: 'n2', name: '蜀道集团', type: 'company', x: 250, y: 200, connections: 45, caVerified: true },
  { id: 'n3', name: 'Python/ML', type: 'skill', x: 550, y: 250, connections: 89, caVerified: false },
  { id: 'n4', name: '李思涵', type: 'talent', x: 350, y: 450, connections: 8, caVerified: true },
  { id: 'n5', name: '川投集团', type: 'company', x: 600, y: 400, connections: 32, caVerified: true },
  { id: 'n6', name: '高级算法工程师', type: 'position', x: 200, y: 380, connections: 15, caVerified: false },
  { id: 'n7', name: '陈雅琪', type: 'talent', x: 480, y: 150, connections: 19, caVerified: true },
  { id: 'n8', name: 'React/TS', type: 'skill', x: 150, y: 300, connections: 67, caVerified: false },
];

export const graphEdges: GraphEdge[] = [
  { source: 'n1', target: 'n2', type: 'employed_at', caSigned: true, weight: 0.9 },
  { source: 'n1', target: 'n3', type: 'has_skill', caSigned: false, weight: 0.85 },
  { source: 'n4', target: 'n8', type: 'has_skill', caSigned: false, weight: 0.92 },
  { source: 'n7', target: 'n5', type: 'employed_at', caSigned: true, weight: 0.88 },
  { source: 'n1', target: 'n4', type: 'referred_by', caSigned: true, weight: 0.75 },
  { source: 'n7', target: 'n3', type: 'has_skill', caSigned: false, weight: 0.95 },
];

export const sourcingResults: SourcingResult[] = [
  { id: 'S-001', name: '赵晓峰', currentRole: '高级产品经理', company: '字节跳动', matchScore: 88, skills: ['B2B SaaS', '数据驱动', '团队管理'], source: 'LinkedIn', reachable: true, contacted: false },
  { id: 'S-002', name: '钱丽华', currentRole: '算法专家', company: '阿里巴巴', matchScore: 92, skills: ['NLP', '推荐系统', 'Python'], source: 'GitHub', reachable: true, contacted: false },
  { id: 'S-003', name: '孙伟', currentRole: '架构师', company: '腾讯', matchScore: 85, skills: ['分布式', 'Go', '微服务'], source: '脉脉', reachable: false, contacted: false },
  { id: 'S-004', name: '周敏', currentRole: '数据科学家', company: '美团', matchScore: 79, skills: ['PyTorch', 'CV', 'MLOps'], source: 'LinkedIn', reachable: true, contacted: true },
  { id: 'S-005', name: '吴强', currentRole: 'DevOps Lead', company: '华为', matchScore: 91, skills: ['K8s', 'CI/CD', '云原生'], source: 'GitHub', reachable: true, contacted: false },
];

export const interviewSessions: InterviewSession[] = [
  { id: 'I-001', candidate: '张明远', position: '高级算法工程师', status: 'completed', startTime: '2024-03-12 14:00', duration: 45, hardSkillScore: 91, softSkillScore: 85, authenticityScore: 94, dynamicQuestions: 12,
    transcript: [
      { role: 'ai', content: '请描述您在NLP项目中处理长文本理解的技术方案。', timestamp: '14:01', evidenceLink: 'skill_nlp_depth' },
      { role: 'candidate', content: '我们采用了分层注意力机制，首先对文档进行段落级分割，然后通过Longformer架构处理跨段落依赖...', timestamp: '14:02' },
      { role: 'ai', content: '您提到Longformer——在实际部署中遇到了哪些推理延迟问题？如何优化的？', timestamp: '14:04', evidenceLink: 'skill_deployment' },
      { role: 'candidate', content: '主要瓶颈在attention window的动态扩展。我们通过量化+知识蒸馏将推理时间从120ms降到35ms...', timestamp: '14:06' },
      { role: 'system', content: '[追问触发] 检测到候选人具备深度工程实践，切换至系统设计追问路径', timestamp: '14:06' },
      { role: 'ai', content: '如果需要将该方案扩展到日均10亿次调用的场景，您会如何设计整体架构？', timestamp: '14:07', evidenceLink: 'skill_system_design' },
      { role: 'candidate', content: '我会采用三层架构：接入层做流量调度和A/B分流，推理层用Triton做模型服务并支持动态batch...', timestamp: '14:10' },
    ]
  },
  { id: 'I-002', candidate: '李思涵', position: '前端架构师', status: 'in_progress', startTime: '2024-03-15 10:00', duration: 30, hardSkillScore: 0, softSkillScore: 0, authenticityScore: 0, dynamicQuestions: 8,
    transcript: [
      { role: 'ai', content: '请介绍您在大型React应用中的状态管理策略演进。', timestamp: '10:01' },
      { role: 'candidate', content: '从Redux到Zustand再到Server Components，我经历了三代状态管理范式的迁移...', timestamp: '10:03' },
    ]
  },
];

export const endorsementCards: EndorsementCard[] = [
  { id: 'E-001', candidate: '刘浩然', position: 'DevOps架构师', issuer: '蜀道集团HR部', status: 'verified', caSignature: 'SM2:3a7f...c2d1', sm3Hash: 'SM3:8b4e...f1a9', shareUrl: 'https://trust.rongcaitong.com/e/abc123', createdAt: '2024-03-14', verifiedCount: 23 },
  { id: 'E-002', candidate: '张明远', position: '高级算法工程师', issuer: '川投集团技术部', status: 'signed', caSignature: 'SM2:5c9d...a4b2', sm3Hash: 'SM3:2f7a...d8c3', shareUrl: 'https://trust.rongcaitong.com/e/def456', createdAt: '2024-03-15', verifiedCount: 0 },
  { id: 'E-003', candidate: '陈雅琪', position: '首席数据科学家', issuer: '五粮液数字化部', status: 'shared', caSignature: 'SM2:7e2b...d5f8', sm3Hash: 'SM3:4c1d...e6a7', shareUrl: 'https://trust.rongcaitong.com/e/ghi789', createdAt: '2024-03-13', verifiedCount: 8 },
];

export const expertReviews: ExpertReview[] = [
  { id: 'R-001', candidate: '张明远', position: '高级算法工程师', domain: 'AI/ML', deadline: '2024-03-18', status: 'pending', reward: 500, anonymized: true },
  { id: 'R-002', candidate: '李思涵', position: '前端架构师', domain: '前端工程', deadline: '2024-03-17', status: 'in_progress', reward: 400, anonymized: true },
  { id: 'R-003', candidate: '周伟明', position: '安全工程师', domain: '网络安全', deadline: '2024-03-20', status: 'pending', reward: 600, anonymized: true },
];

export const successionSlots: SuccessionSlot[] = [
  { id: 'SS-001', position: 'CTO', incumbent: '王大明', readiness: 'ready_1yr', candidates: [{ name: '李思涵', score: 87, gap: '管理经验' }, { name: '张明远', score: 82, gap: '战略视野' }], riskLevel: 'medium' },
  { id: 'SS-002', position: '数据VP', incumbent: '陈雅琪', readiness: 'ready_now', candidates: [{ name: '周敏', score: 79, gap: '团队规模' }], riskLevel: 'low' },
  { id: 'SS-003', position: '安全总监', incumbent: '赵安', readiness: 'ready_2yr', candidates: [{ name: '周伟明', score: 91, gap: '合规认证' }, { name: '吴强', score: 74, gap: '安全专项' }], riskLevel: 'high' },
];

export const decisionLineage: DecisionLineageStep[] = [
  { id: 'L-01', phase: 'Sourcing', action: '全网穿透寻访', actor: 'Market Agent', timestamp: '2024-03-01 09:00', evidenceLinks: [{ type: 'profile_match', source: 'LinkedIn', confidence: 0.88 }, { type: 'github_activity', source: 'GitHub', confidence: 0.92 }], sm3Hash: 'SM3:1a2b...3c4d', modelVersion: 'v2.3.0', promptVersion: 'source-v3' },
  { id: 'L-02', phase: 'Screening', action: '简历深度解析+匹配评分', actor: 'Skill Agent', timestamp: '2024-03-02 10:30', evidenceLinks: [{ type: 'skill_match', source: '简历解析', confidence: 0.94 }, { type: 'experience_depth', source: '项目验证', confidence: 0.87 }], counterEvidence: [{ type: 'stability_risk', source: '跳槽频率分析', note: '近3年换3家公司，稳定性风险中等' }], sm3Hash: 'SM3:5e6f...7g8h', modelVersion: 'v2.3.1', promptVersion: 'screen-v4' },
  { id: 'L-03', phase: 'Interview', action: 'AI异步面试（12轮动态追问）', actor: 'Interview Agent', timestamp: '2024-03-12 14:00', evidenceLinks: [{ type: 'hard_skill', source: '面试评分矩阵', confidence: 0.91 }, { type: 'soft_skill', source: '沟通表达分析', confidence: 0.85 }, { type: 'authenticity', source: '真实性校验', confidence: 0.94 }], sm3Hash: 'SM3:9i0j...1k2l', modelVersion: 'v2.3.1', promptVersion: 'interview-v5' },
  { id: 'L-04', phase: 'Risk Check', action: '背调+风险评估', actor: 'Risk Agent', timestamp: '2024-03-13 09:00', evidenceLinks: [{ type: 'background_clear', source: '第三方背调', confidence: 0.96 }], counterEvidence: [{ type: 'competitor_clause', source: '竞业协议检查', note: '已过竞业期，无风险' }], sm3Hash: 'SM3:3m4n...5o6p', modelVersion: 'v2.3.1', promptVersion: 'risk-v3' },
  { id: 'L-05', phase: 'Compensation', action: 'ROI最优定薪', actor: 'Compensation Agent', timestamp: '2024-03-14 11:00', evidenceLinks: [{ type: 'market_benchmark', source: '薪酬大盘P75', confidence: 0.89 }, { type: 'internal_equity', source: '内部公平性', confidence: 0.91 }], sm3Hash: 'SM3:7q8r...9s0t', modelVersion: 'v2.3.1', promptVersion: 'comp-v4' },
  { id: 'L-06', phase: 'Decision', action: 'U盾SM2签名+SM3存证', actor: 'HRD 王总', timestamp: '2024-03-15 09:30', evidenceLinks: [{ type: 'human_approval', source: 'HRD审批', confidence: 1.0 }], sm3Hash: 'SM3:1u2v...3w4x', caSignature: 'SM2:5y6z...7a8b' },
];

export const sseEvents: SSEEvent[] = [
  { id: 'ev-1', type: 'decision_published', title: '决策已发布', description: '张明远 Hire 决策经U盾签名后发布', timestamp: '09:30', priority: 'high' },
  { id: 'ev-2', type: 'interview_scored', title: '面试评分完成', description: '李思涵 前端架构师面试评分：88/100', timestamp: '10:15', priority: 'medium' },
  { id: 'ev-3', type: 'risk_flagged', title: '风险预警', description: '陈雅琪 背调发现竞业条款需人工确认', timestamp: '11:02', priority: 'high' },
  { id: 'ev-4', type: 'candidate_sourced', title: '新候选人入池', description: '赵晓峰 通过LinkedIn寻访入池', timestamp: '14:20', priority: 'low' },
  { id: 'ev-5', type: 'offer_signed', title: 'Offer已签署', description: '刘浩然 DevOps架构师 Offer经CA签名存证', timestamp: '16:45', priority: 'high' },
];

export const orgHealthMetrics = {
  tqdv: { value: 47, trend: '+12%', label: 'TQDV（可信决策量）' },
  graphEdges: { value: '12.8万', trend: '+8.3%', label: '图谱关系边' },
  avgTimeToHire: { value: '18天', trend: '-32%', label: '平均招聘周期' },
  endorsementConversion: { value: '11.2%', trend: '+3.1%', label: '背书转化率' },
  aiAutonomy: { value: '72%', trend: '+5%', label: 'AI自主率' },
  trustCoverage: { value: '89%', trend: '+4%', label: 'U盾签名覆盖' },
};

export interface SuccessionPlanItem {
  id: string; position: string; riskLevel: 'low' | 'medium' | 'high';
  incumbent: { name: string; tenure: number; retireIn: number };
  successors: { name: string; currentRole: string; readiness: number }[];
}

export const successionPlan: SuccessionPlanItem[] = [
  { id: 'SP-001', position: 'CTO', riskLevel: 'medium', incumbent: { name: '王大明', tenure: 8, retireIn: 5 }, successors: [{ name: '李思涵', currentRole: '前端架构师', readiness: 87 }, { name: '张明远', currentRole: '算法工程师', readiness: 82 }] },
  { id: 'SP-002', position: '数据VP', riskLevel: 'low', incumbent: { name: '陈雅琪', tenure: 5, retireIn: 12 }, successors: [{ name: '周敏', currentRole: '数据科学家', readiness: 79 }] },
  { id: 'SP-003', position: '安全总监', riskLevel: 'high', incumbent: { name: '赵安', tenure: 12, retireIn: 2 }, successors: [{ name: '周伟明', currentRole: '安全工程师', readiness: 91 }, { name: '吴强', currentRole: 'DevOps Lead', readiness: 74 }] },
];

export interface TalentCommonsItem {
  id: string; name: string; organization: string; domains: string[];
  shareType: string; availableFrom: string; caVerified: boolean;
}

export const talentCommons: TalentCommonsItem[] = [
  { id: 'TC-001', name: '刘浩然', organization: '蜀道集团', domains: ['DevOps', '云原生'], shareType: '项目借调', availableFrom: '2024-04-01', caVerified: true },
  { id: 'TC-002', name: '孙婷婷', organization: '川投集团', domains: ['UI/UX', '设计系统'], shareType: '兼职顾问', availableFrom: '2024-03-20', caVerified: true },
  { id: 'TC-003', name: '赵晓峰', organization: '五粮液数字化', domains: ['产品管理', 'B2B'], shareType: '短期交流', availableFrom: '2024-04-15', caVerified: false },
  { id: 'TC-004', name: '钱丽华', organization: '长虹集团', domains: ['NLP', '推荐系统'], shareType: '项目借调', availableFrom: '2024-05-01', caVerified: true },
];
