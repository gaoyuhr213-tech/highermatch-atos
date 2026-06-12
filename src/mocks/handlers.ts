/**
 * HigherMatch ATOS — MSW Request Handlers
 * 
 * 开发环境API模拟层，完整覆盖所有业务端点。
 * 严格对齐 src/lib/api/types.ts 的 PaginatedResponse<T> 结构
 * 严格对齐 src/lib/api/services.ts 的端点路径
 */

import { http, HttpResponse, delay } from 'msw';
import {
  decisionProposals,
  pipelineCandidates,
  graphNodes,
  graphEdges,
  sourcingResults,
  interviewSessions,
  endorsementCards,
  expertReviews,
  successionSlots,
  decisionLineage,
  sseEvents,
  orgHealthMetrics,
  successionPlan,
  talentCommons,
} from '../data/mock-data';
import type { PipelineCandidate } from '../data/mock-data';

const API_BASE = '/api/v1';

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/** 对齐 PaginatedResponse<T> = { items, total, page, pageSize, hasMore } */
function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const sliced = items.slice(start, end);
  return {
    items: sliced,
    total: items.length,
    page,
    pageSize,
    hasMore: end < items.length,
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200 }));
  const sig = btoa('mock-signature-' + Date.now());
  return `${header}.${body}.${sig}`;
}

function now(): string { return new Date().toISOString(); }

// ─── Mock Data: Jobs ────────────────────────────────────────────────────────

const mockJobs = [
  { id: 'job-001', tenantId: 'tenant-001', enterpriseId: 'ent-001', title: '高级前端工程师', department: '技术部', location: '成都', salaryMin: 25000, salaryMax: 40000, salaryCurrency: 'CNY' as const, jobType: 'full_time' as const, experienceMin: 3, experienceMax: 8, educationRequirement: 'bachelor' as const, description: '负责蓉才通前端架构设计与核心模块开发', requirements: ['React', 'TypeScript', '3年以上经验'], benefits: ['五险一金', '弹性工作', '年终奖'], status: 'active' as const, caVerified: true, viewCount: 342, applyCount: 28, publishedAt: '2024-03-01T08:00:00Z', createdAt: '2024-02-28T10:00:00Z', updatedAt: '2024-03-01T08:00:00Z' },
  { id: 'job-002', tenantId: 'tenant-001', enterpriseId: 'ent-001', title: '后端架构师', department: '技术部', location: '成都', salaryMin: 35000, salaryMax: 55000, salaryCurrency: 'CNY' as const, jobType: 'full_time' as const, experienceMin: 5, experienceMax: 12, educationRequirement: 'master' as const, description: '负责蓉才通后端微服务架构设计', requirements: ['Node.js', 'Go', '分布式系统'], benefits: ['五险一金', '期权', '年终奖'], status: 'active' as const, caVerified: true, viewCount: 256, applyCount: 15, publishedAt: '2024-03-02T08:00:00Z', createdAt: '2024-02-28T11:00:00Z', updatedAt: '2024-03-02T08:00:00Z' },
  { id: 'job-003', tenantId: 'tenant-001', enterpriseId: 'ent-001', title: 'AI算法工程师', department: '算法部', location: '成都', salaryMin: 30000, salaryMax: 50000, salaryCurrency: 'CNY' as const, jobType: 'full_time' as const, experienceMin: 2, experienceMax: 6, educationRequirement: 'master' as const, description: '负责AI招聘引擎核心算法研发', requirements: ['Python', 'NLP', 'LLM'], benefits: ['五险一金', 'GPU集群', '论文奖金'], status: 'active' as const, caVerified: true, viewCount: 189, applyCount: 22, publishedAt: '2024-03-03T08:00:00Z', createdAt: '2024-03-01T09:00:00Z', updatedAt: '2024-03-03T08:00:00Z' },
  { id: 'job-004', tenantId: 'tenant-001', enterpriseId: 'ent-001', title: '产品经理', department: '产品部', location: '成都', salaryMin: 20000, salaryMax: 35000, salaryCurrency: 'CNY' as const, jobType: 'full_time' as const, experienceMin: 3, experienceMax: 7, educationRequirement: 'bachelor' as const, description: '负责蓉才通产品规划与需求管理', requirements: ['B端产品经验', '数据分析', '原型设计'], benefits: ['五险一金', '弹性工作'], status: 'draft' as const, caVerified: true, viewCount: 0, applyCount: 0, createdAt: '2024-03-10T09:00:00Z', updatedAt: '2024-03-10T09:00:00Z' },
  { id: 'job-005', tenantId: 'tenant-001', enterpriseId: 'ent-001', title: 'HRBP', department: '人力资源部', location: '成都', salaryMin: 15000, salaryMax: 25000, salaryCurrency: 'CNY' as const, jobType: 'full_time' as const, experienceMin: 2, experienceMax: 5, educationRequirement: 'bachelor' as const, description: '负责业务线人力资源支持', requirements: ['HRBP经验', '劳动法', '招聘'], benefits: ['五险一金', '培训机会'], status: 'active' as const, caVerified: false, viewCount: 98, applyCount: 12, publishedAt: '2024-03-05T08:00:00Z', createdAt: '2024-03-04T10:00:00Z', updatedAt: '2024-03-05T08:00:00Z' },
];

// ─── Mock Data: Candidates ──────────────────────────────────────────────────

const mockCandidates = [
  { id: 'cand-001', name: '张明远', email: 'zhang@example.com', phone: '13800138001', avatar: '', currentCompany: '腾讯', currentTitle: '高级前端工程师', yearsOfExperience: 5, education: '四川大学 · 计算机科学 · 硕士', skills: ['React', 'TypeScript', 'Node.js', 'Vue'], resumeUrl: '/resumes/zhang.pdf', source: 'direct' as const, trustScore: 92, createdAt: '2024-03-01T10:00:00Z' },
  { id: 'cand-002', name: '李思涵', email: 'li@example.com', phone: '13800138002', avatar: '', currentCompany: '阿里巴巴', currentTitle: '技术专家', yearsOfExperience: 8, education: '清华大学 · 软件工程 · 硕士', skills: ['Go', 'Java', '分布式系统', 'Kubernetes'], resumeUrl: '/resumes/li.pdf', source: 'headhunt' as const, trustScore: 95, createdAt: '2024-03-02T10:00:00Z' },
  { id: 'cand-003', name: '王建国', email: 'wang@example.com', phone: '13800138003', avatar: '', currentCompany: '字节跳动', currentTitle: 'AI工程师', yearsOfExperience: 4, education: '电子科技大学 · 人工智能 · 硕士', skills: ['Python', 'PyTorch', 'NLP', 'LLM'], resumeUrl: '/resumes/wang.pdf', source: 'referral' as const, trustScore: 88, createdAt: '2024-03-03T10:00:00Z' },
  { id: 'cand-004', name: '赵雪梅', email: 'zhao@example.com', phone: '13800138004', avatar: '', currentCompany: '华为', currentTitle: '产品经理', yearsOfExperience: 6, education: '浙江大学 · 管理学 · 本科', skills: ['产品设计', '数据分析', 'Axure', 'SQL'], resumeUrl: '/resumes/zhao.pdf', source: 'direct' as const, trustScore: 85, createdAt: '2024-03-04T10:00:00Z' },
  { id: 'cand-005', name: '陈志强', email: 'chen@example.com', phone: '13800138005', avatar: '', currentCompany: '美团', currentTitle: '后端工程师', yearsOfExperience: 3, education: '西南交通大学 · 计算机 · 本科', skills: ['Java', 'Spring Boot', 'MySQL', 'Redis'], resumeUrl: '/resumes/chen.pdf', source: 'talent_pool' as const, trustScore: 78, createdAt: '2024-03-05T10:00:00Z' },
];

// ─── Mock Data: Applications ────────────────────────────────────────────────

const mockApplications = [
  { id: 'app-001', tenantId: 'tenant-001', jobId: 'job-001', candidateId: 'cand-001', status: 'interviewing' as const, stage: 'technical_interview', aiScore: 92, aiRecommendation: '强烈推荐', appliedAt: '2024-03-05T10:00:00Z', updatedAt: '2024-03-10T14:00:00Z', candidate: mockCandidates[0], job: mockJobs[0] },
  { id: 'app-002', tenantId: 'tenant-001', jobId: 'job-002', candidateId: 'cand-002', status: 'offer_pending' as const, stage: 'offer_review', aiScore: 95, aiRecommendation: '强烈推荐', appliedAt: '2024-03-06T10:00:00Z', updatedAt: '2024-03-12T09:00:00Z', candidate: mockCandidates[1], job: mockJobs[1] },
  { id: 'app-003', tenantId: 'tenant-001', jobId: 'job-003', candidateId: 'cand-003', status: 'screening' as const, stage: 'resume_review', aiScore: 88, aiRecommendation: '推荐', appliedAt: '2024-03-07T10:00:00Z', updatedAt: '2024-03-08T11:00:00Z', candidate: mockCandidates[2], job: mockJobs[2] },
  { id: 'app-004', tenantId: 'tenant-001', jobId: 'job-004', candidateId: 'cand-004', status: 'applied' as const, stage: 'new', aiScore: 82, aiRecommendation: '待评估', appliedAt: '2024-03-10T10:00:00Z', updatedAt: '2024-03-10T10:00:00Z', candidate: mockCandidates[3], job: mockJobs[3] },
  { id: 'app-005', tenantId: 'tenant-001', jobId: 'job-001', candidateId: 'cand-005', status: 'rejected' as const, stage: 'screening', aiScore: 65, aiRecommendation: '不推荐', appliedAt: '2024-03-08T10:00:00Z', updatedAt: '2024-03-09T16:00:00Z', candidate: mockCandidates[4], job: mockJobs[0] },
];

// ─── Mock Data: Interviews ──────────────────────────────────────────────────

const mockInterviews = [
  { id: 'int-001', tenantId: 'tenant-001', applicationId: 'app-001', type: 'video' as const, status: 'completed' as const, scheduledAt: '2024-03-10T14:00:00Z', duration: 60, interviewers: ['user-002'], location: '', meetingUrl: 'https://meeting.example.com/int-001', feedback: { overallScore: 4, technicalScore: 5, communicationScore: 4, cultureFitScore: 4, strengths: ['技术深度好', '系统设计能力强'], concerns: ['管理经验偏少'], recommendation: 'hire' as const, notes: '整体表现优秀' }, aiAnalysis: { sentimentScore: 0.85, confidenceLevel: 0.9, keyInsights: ['对React生态理解深入', '有大型项目经验'], riskFlags: [], matchScore: 0.92 }, createdAt: '2024-03-08T10:00:00Z' },
  { id: 'int-002', tenantId: 'tenant-001', applicationId: 'app-002', type: 'onsite' as const, status: 'completed' as const, scheduledAt: '2024-03-11T10:00:00Z', duration: 90, interviewers: ['user-001', 'user-002'], location: '成都办公室A302', meetingUrl: '', feedback: { overallScore: 5, technicalScore: 5, communicationScore: 5, cultureFitScore: 4, strengths: ['架构能力顶尖', '团队领导力强'], concerns: ['薪资期望偏高'], recommendation: 'strong_hire' as const, notes: '极力推荐' }, aiAnalysis: { sentimentScore: 0.92, confidenceLevel: 0.95, keyInsights: ['分布式系统专家', '有CTO潜力'], riskFlags: [], matchScore: 0.96 }, createdAt: '2024-03-09T10:00:00Z' },
  { id: 'int-003', tenantId: 'tenant-001', applicationId: 'app-003', type: 'ai_screening' as const, status: 'scheduled' as const, scheduledAt: '2024-03-15T14:00:00Z', duration: 45, interviewers: [], meetingUrl: 'https://ai-interview.example.com/int-003', createdAt: '2024-03-12T10:00:00Z' },
];

// ─── Mock Data: Audit Logs ──────────────────────────────────────────────────

const mockAuditLogs = [
  { id: 'audit-001', tenantId: 'tenant-001', userId: 'user-001', userName: '管理员', action: 'login' as const, resource: 'auth', resourceId: 'user-001', details: { method: 'ushield', certSN: 'SCCA-2024-001' }, ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T08:00:00Z' },
  { id: 'audit-002', tenantId: 'tenant-001', userId: 'user-001', userName: '管理员', action: 'create' as const, resource: 'job', resourceId: 'job-001', details: { title: '高级前端工程师' }, ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T08:30:00Z' },
  { id: 'audit-003', tenantId: 'tenant-001', userId: 'user-002', userName: 'HR专员', action: 'update' as const, resource: 'application', resourceId: 'app-001', details: { status: 'interviewing', previousStatus: 'screening' }, ipAddress: '192.168.1.101', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T09:00:00Z' },
  { id: 'audit-004', tenantId: 'tenant-001', userId: 'user-001', userName: '管理员', action: 'approve' as const, resource: 'job', resourceId: 'job-002', details: { action: 'publish' }, ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T09:30:00Z' },
  { id: 'audit-005', tenantId: 'tenant-001', userId: 'user-003', userName: '面试官', action: 'view' as const, resource: 'candidate', resourceId: 'cand-001', details: { section: 'resume' }, ipAddress: '192.168.1.102', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T10:00:00Z' },
  { id: 'audit-006', tenantId: 'tenant-001', userId: 'user-001', userName: '管理员', action: 'export' as const, resource: 'report', resourceId: 'report-001', details: { format: 'csv', rows: 150 }, ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T10:30:00Z' },
  { id: 'audit-007', tenantId: 'tenant-001', userId: 'user-002', userName: 'HR专员', action: 'verify' as const, resource: 'enterprise', resourceId: 'ent-001', details: { method: 'ca_cert', certSN: 'SCCA-2024-001' }, ipAddress: '192.168.1.101', userAgent: 'Mozilla/5.0', timestamp: '2024-03-15T11:00:00Z' },
];

// ─── Mock Data: Community Posts ──────────────────────────────────────────────

const mockCommunityPosts = [
  { id: 'post-001', tenantId: 'tenant-001', authorId: 'user-002', authorName: '刘HR', authorRole: 'hr_manager' as const, authorVerified: true, title: '如何通过CA认证提升企业招聘信任度', content: '分享我们使用CA认证后的招聘数据变化...', category: 'hiring_tips' as const, tags: ['CA认证', '信任招聘'], status: 'published' as const, likeCount: 42, commentCount: 8, viewCount: 320, createdAt: '2024-03-10T10:00:00Z' },
  { id: 'post-002', tenantId: 'tenant-001', authorId: 'user-001', authorName: '张总', authorRole: 'admin' as const, authorVerified: true, title: '2024年成都IT人才市场趋势分析', content: '基于平台数据的市场洞察...', category: 'industry_insight' as const, tags: ['市场趋势', '成都'], status: 'published' as const, likeCount: 67, commentCount: 15, viewCount: 580, createdAt: '2024-03-08T10:00:00Z' },
  { id: 'post-003', tenantId: 'tenant-001', authorId: 'user-003', authorName: '王面试官', authorRole: 'interviewer' as const, authorVerified: true, title: 'AI异步面试使用心得', content: '使用AI面试功能一个月后的真实反馈...', category: 'tool_review' as const, tags: ['AI面试', '效率'], status: 'published' as const, likeCount: 35, commentCount: 12, viewCount: 245, createdAt: '2024-03-12T10:00:00Z' },
];

// ─── Mock User ──────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-001',
  tenantId: 'tenant-001',
  name: '张伟',
  email: 'zhangwei@scca-demo.cn',
  phone: '13800138000',
  role: 'admin' as const,
  avatar: '',
  caVerified: true,
  caCertSN: 'SCCA-2024-001',
  lastLoginAt: now(),
  createdAt: '2024-01-01T00:00:00Z',
};

const mockEnterprise = {
  id: 'ent-001',
  tenantId: 'tenant-001',
  name: '四川省数字证书认证管理中心',
  unifiedSocialCreditCode: '91510100MA62N8XL3T',
  legalRepresentative: '李明',
  registeredCapital: '5000万',
  industry: '信息技术',
  scale: '200-500' as const,
  address: '成都市高新区天府大道北段1700号',
  contactPerson: '张伟',
  contactPhone: '13800138000',
  caVerifyStatus: 'verified' as const,
  caCertSN: 'SCCA-2024-001',
  caVerifiedAt: '2024-01-15T10:00:00Z',
  trustScore: 98,
  createdAt: '2024-01-01T00:00:00Z',
};

// ─── Auth Handlers ──────────────────────────────────────────────────────────

const authHandlers = [
  http.post(`${API_BASE}/auth/ushield/challenge`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        challengeId: generateId(),
        nonce: Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        expiresAt: Date.now() + 300000,
      },
    });
  }),

  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    if (body.type === 'ushield' || body.type === 'password') {
      return HttpResponse.json({
        success: true,
        data: {
          accessToken: generateJWT({ sub: mockUser.id, role: mockUser.role, tenantId: mockUser.tenantId }),
          refreshToken: generateJWT({ sub: mockUser.id, type: 'refresh' }),
          expiresIn: 7200,
          user: mockUser,
        },
      });
    }
    return HttpResponse.json({ success: false, error: { code: 'AUTH_FAILED', message: '认证失败' } }, { status: 401 });
  }),

  http.post(`${API_BASE}/auth/refresh`, async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: generateJWT({ sub: mockUser.id, role: mockUser.role, tenantId: mockUser.tenantId }),
        refreshToken: generateJWT({ sub: mockUser.id, type: 'refresh' }),
        expiresIn: 7200,
      },
    });
  }),

  http.post(`${API_BASE}/auth/logout`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: null });
  }),

  http.get(`${API_BASE}/auth/me`, async () => {
    await delay(150);
    return HttpResponse.json({ success: true, data: mockUser });
  }),

  http.post(`${API_BASE}/auth/change-password`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: null });
  }),
];

// ─── Enterprise Handlers ────────────────────────────────────────────────────

const enterpriseHandlers = [
  http.get(`${API_BASE}/enterprises/current`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: mockEnterprise });
  }),

  http.get(`${API_BASE}/enterprises/:id`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: mockEnterprise });
  }),

  http.patch(`${API_BASE}/enterprises/:id`, async ({ request }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...mockEnterprise, ...body } });
  }),

  http.post(`${API_BASE}/enterprises/:id/ca-verify`, async () => {
    await delay(500);
    return HttpResponse.json({ success: true, data: { verificationId: generateId() } });
  }),

  http.get(`${API_BASE}/enterprises/:id/ca-status`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { status: 'verified', verifiedAt: '2024-01-15T10:00:00Z' } });
  }),
];

// ─── Job Handlers ───────────────────────────────────────────────────────────

const jobHandlers = [
  http.get(`${API_BASE}/jobs`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';

    let filtered = [...mockJobs];
    if (keyword) filtered = filtered.filter(j => j.title.includes(keyword) || j.department.includes(keyword));
    if (status) filtered = filtered.filter(j => j.status === status);

    return HttpResponse.json({ success: true, data: paginate(filtered, page, pageSize) });
  }),

  http.get(`${API_BASE}/jobs/:id`, async ({ params }) => {
    await delay(150);
    const job = mockJobs.find(j => j.id === params.id) || mockJobs[0];
    return HttpResponse.json({ success: true, data: job });
  }),

  http.post(`${API_BASE}/jobs`, async ({ request }) => {
    await delay(400);
    const body = await request.json() as Record<string, unknown>;
    const newJob = { id: generateId(), tenantId: 'tenant-001', enterpriseId: 'ent-001', ...body, status: 'draft', caVerified: true, viewCount: 0, applyCount: 0, createdAt: now(), updatedAt: now() };
    return HttpResponse.json({ success: true, data: newJob });
  }),

  http.patch(`${API_BASE}/jobs/:id`, async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    const job = mockJobs.find(j => j.id === params.id) || mockJobs[0];
    return HttpResponse.json({ success: true, data: { ...job, ...body, updatedAt: now() } });
  }),

  http.post(`${API_BASE}/jobs/:id/publish`, async ({ params }) => {
    await delay(300);
    const job = mockJobs.find(j => j.id === params.id) || mockJobs[0];
    return HttpResponse.json({ success: true, data: { ...job, status: 'active', publishedAt: now(), updatedAt: now() } });
  }),

  http.post(`${API_BASE}/jobs/:id/close`, async ({ params }) => {
    await delay(300);
    const job = mockJobs.find(j => j.id === params.id) || mockJobs[0];
    return HttpResponse.json({ success: true, data: { ...job, status: 'closed', closedAt: now(), updatedAt: now() } });
  }),

  http.delete(`${API_BASE}/jobs/:id`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: null });
  }),

  // Job QA
  http.get(`${API_BASE}/jobs/:jobId/qa`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'qa-001', jobId: 'job-001', question: '这个岗位的技术栈是什么？', answer: '主要使用React + TypeScript + Node.js，后端使用Go微服务架构。', answeredBy: 'user-002', answeredByName: 'HR刘经理', isOfficial: true, caVerified: true, helpfulCount: 15, createdAt: '2024-03-05T10:00:00Z' },
        { id: 'qa-002', jobId: 'job-001', question: '是否支持远程办公？', answer: '支持混合办公模式，每周至少3天到岗。', answeredBy: 'user-002', answeredByName: 'HR刘经理', isOfficial: true, caVerified: true, helpfulCount: 8, createdAt: '2024-03-06T10:00:00Z' },
        { id: 'qa-003', jobId: 'job-001', question: '面试流程是怎样的？', answer: '共三轮：技术面→项目面→HR面，全程约2周。', answeredBy: 'user-002', answeredByName: 'HR刘经理', isOfficial: true, caVerified: true, helpfulCount: 12, createdAt: '2024-03-07T10:00:00Z' },
      ],
    });
  }),

  http.post(`${API_BASE}/jobs/:jobId/qa`, async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { id: generateId(), jobId: params.jobId, question: body.question, answer: '', answeredBy: '', answeredByName: '', isOfficial: false, caVerified: false, helpfulCount: 0, createdAt: now() },
    });
  }),

  http.post(`${API_BASE}/jobs/:jobId/qa/:qaId/answer`, async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { id: params.qaId, jobId: params.jobId, question: '问题', answer: body.answer, answeredBy: mockUser.id, answeredByName: mockUser.name, isOfficial: true, caVerified: true, helpfulCount: 0, createdAt: now() },
    });
  }),
];

// ─── Application Handlers ───────────────────────────────────────────────────

const applicationHandlers = [
  http.get(`${API_BASE}/applications`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const jobId = url.searchParams.get('jobId') || '';
    const status = url.searchParams.get('status') || '';

    let filtered = [...mockApplications];
    if (jobId) filtered = filtered.filter(a => a.jobId === jobId);
    if (status) filtered = filtered.filter(a => a.status === status);

    return HttpResponse.json({ success: true, data: paginate(filtered, page, pageSize) });
  }),

  http.get(`${API_BASE}/applications/:id`, async ({ params }) => {
    await delay(150);
    const app = mockApplications.find(a => a.id === params.id) || mockApplications[0];
    return HttpResponse.json({ success: true, data: app });
  }),

  http.patch(`${API_BASE}/applications/:id/status`, async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    const app = mockApplications.find(a => a.id === params.id) || mockApplications[0];
    return HttpResponse.json({ success: true, data: { ...app, status: body.status, updatedAt: now() } });
  }),

  http.post(`${API_BASE}/applications/batch-status`, async ({ request }) => {
    await delay(400);
    const body = await request.json() as Record<string, unknown>;
    const ids = body.ids as string[];
    return HttpResponse.json({ success: true, data: { updated: ids.length } });
  }),

  http.post(`${API_BASE}/applications/:id/ai-score`, async () => {
    await delay(800);
    return HttpResponse.json({
      success: true,
      data: { score: 85 + Math.floor(Math.random() * 10), recommendation: '推荐面试', factors: ['技能匹配度高', '经验年限符合', '教育背景优秀'] },
    });
  }),
];

// ─── Interview Handlers ─────────────────────────────────────────────────────

const interviewHandlers = [
  http.get(`${API_BASE}/interviews`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(mockInterviews, page, pageSize) });
  }),

  http.post(`${API_BASE}/interviews`, async ({ request }) => {
    await delay(400);
    const body = await request.json() as Record<string, unknown>;
    const newInterview = { id: generateId(), tenantId: 'tenant-001', ...body, status: 'scheduled', createdAt: now() };
    return HttpResponse.json({ success: true, data: newInterview });
  }),

  http.post(`${API_BASE}/interviews/:id/feedback`, async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    const interview = mockInterviews.find(i => i.id === params.id) || mockInterviews[0];
    return HttpResponse.json({ success: true, data: { ...interview, feedback: body, status: 'completed' } });
  }),

  http.post(`${API_BASE}/interviews/:id/cancel`, async ({ params }) => {
    await delay(200);
    const interview = mockInterviews.find(i => i.id === params.id) || mockInterviews[0];
    return HttpResponse.json({ success: true, data: { ...interview, status: 'cancelled' } });
  }),

  http.get(`${API_BASE}/interviews/:id/ai-analysis`, async () => {
    await delay(500);
    return HttpResponse.json({
      success: true,
      data: { sentimentScore: 0.85, confidenceLevel: 0.9, keyInsights: ['技术深度好', '沟通能力强'], riskFlags: [], matchScore: 0.92 },
    });
  }),
];

// ─── Trust Handlers ─────────────────────────────────────────────────────────

const trustHandlers = [
  http.get(`${API_BASE}/trust/records/:subjectType/:subjectId`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        id: generateId(),
        tenantId: 'tenant-001',
        subjectType: 'enterprise',
        subjectId: 'ent-001',
        trustLevel: 'L3_ca_certified',
        evidenceHash: 'a3f2c8d1e5b7...sm3hash',
        caSignature: 'SM2-SIG-SCCA-2024...',
        verifiedAt: '2024-01-15T10:00:00Z',
        expiresAt: '2025-01-15T10:00:00Z',
        metadata: { certSN: 'SCCA-2024-001', issuer: '四川CA' },
      },
    });
  }),

  http.get(`${API_BASE}/trust/evidence/:subjectId`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const evidenceItems = [
      { id: 'ev-001', operationType: 'enterprise_verify', operatorId: 'user-001', operatorName: '系统', timestamp: '2024-01-15T10:00:00Z', dataHash: 'sm3-hash-001', previousHash: '0000000000', signature: 'sm2-sig-001', payload: { certSN: 'SCCA-2024-001' } },
      { id: 'ev-002', operationType: 'job_publish', operatorId: 'user-001', operatorName: '张伟', timestamp: '2024-03-01T08:00:00Z', dataHash: 'sm3-hash-002', previousHash: 'sm3-hash-001', signature: 'sm2-sig-002', payload: { jobId: 'job-001', title: '高级前端工程师' } },
      { id: 'ev-003', operationType: 'interview_complete', operatorId: 'user-003', operatorName: '面试官', timestamp: '2024-03-10T16:00:00Z', dataHash: 'sm3-hash-003', previousHash: 'sm3-hash-002', signature: 'sm2-sig-003', payload: { interviewId: 'int-001', score: 4 } },
    ];
    return HttpResponse.json({ success: true, data: paginate(evidenceItems, page, pageSize) });
  }),

  http.post(`${API_BASE}/trust/evidence/:evidenceId/verify`, async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { valid: true, verifiedAt: now() } });
  }),

  http.get(`${API_BASE}/trust/chain-status`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        steps: [
          { name: 'U盾硬件登录', status: 'completed', completedAt: '2024-03-15T08:00:00Z' },
          { name: 'CA身份校验', status: 'completed', completedAt: '2024-03-15T08:00:05Z' },
          { name: '企业认证挂载', status: 'completed', completedAt: '2024-01-15T10:00:00Z' },
          { name: '岗位真实答疑', status: 'active' },
          { name: '候选人信任识别', status: 'pending' },
        ],
      },
    });
  }),
];

// ─── Audit Handlers ─────────────────────────────────────────────────────────

const auditHandlers = [
  http.get(`${API_BASE}/audit/logs`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const action = url.searchParams.get('action') || '';
    const resource = url.searchParams.get('resource') || '';

    let filtered = [...mockAuditLogs];
    if (action) filtered = filtered.filter(l => l.action === action);
    if (resource) filtered = filtered.filter(l => l.resource === resource);

    return HttpResponse.json({ success: true, data: paginate(filtered, page, pageSize) });
  }),

  http.post(`${API_BASE}/audit/export`, async () => {
    await delay(500);
    return HttpResponse.json({ success: true, data: { downloadUrl: '/downloads/audit-export-2024.csv' } });
  }),
];

// ─── Analytics Handlers ─────────────────────────────────────────────────────

const analyticsHandlers = [
  http.get(`${API_BASE}/analytics/hiring-metrics`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: {
        totalJobs: 5,
        activeJobs: 4,
        totalApplications: 128,
        interviewRate: 0.45,
        offerRate: 0.22,
        hireRate: 0.15,
        avgTimeToHire: 21,
        avgTimeToInterview: 5,
        trustVerifiedRate: 0.82,
        periodComparison: {
          applications: { current: 128, previous: 95, change: 0.347 },
          interviews: { current: 58, previous: 42, change: 0.381 },
          hires: { current: 19, previous: 14, change: 0.357 },
        },
      },
    });
  }),

  http.get(`${API_BASE}/analytics/pipeline`, async () => {
    await delay(250);
    return HttpResponse.json({
      success: true,
      data: [
        { name: '寻访', count: 45, conversionRate: 1.0 },
        { name: '筛选', count: 32, conversionRate: 0.71 },
        { name: '面试', count: 18, conversionRate: 0.56 },
        { name: '风控', count: 15, conversionRate: 0.83 },
        { name: 'Offer', count: 8, conversionRate: 0.53 },
        { name: '已签', count: 5, conversionRate: 0.63 },
      ],
    });
  }),

  http.get(`${API_BASE}/analytics/trust-metrics`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        verifiedEnterprises: 342,
        totalEnterprises: 580,
        avgTrustScore: 87.5,
        applicationRateBoost: 2.3,
      },
    });
  }),
];

// ─── Community Handlers ─────────────────────────────────────────────────────

const communityHandlers = [
  http.get(`${API_BASE}/community/posts`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const category = url.searchParams.get('category') || '';

    let filtered = [...mockCommunityPosts];
    if (category) filtered = filtered.filter(p => p.category === category);

    return HttpResponse.json({ success: true, data: paginate(filtered, page, pageSize) });
  }),

  http.post(`${API_BASE}/community/posts`, async ({ request }) => {
    await delay(400);
    const body = await request.json() as Record<string, unknown>;
    const newPost = {
      id: generateId(), tenantId: 'tenant-001', authorId: mockUser.id, authorName: mockUser.name,
      authorRole: mockUser.role, authorVerified: true, ...body,
      status: 'pending_review', likeCount: 0, commentCount: 0, viewCount: 0, createdAt: now(),
    };
    return HttpResponse.json({ success: true, data: newPost });
  }),

  http.post(`${API_BASE}/community/posts/:id/like`, async () => {
    await delay(150);
    return HttpResponse.json({ success: true, data: { likeCount: 43 } });
  }),
];

// ─── AI Handlers ────────────────────────────────────────────────────────────

const aiHandlers = [
  http.post(`${API_BASE}/ai/resume/parse`, async () => {
    await delay(1500);
    return HttpResponse.json({
      success: true,
      data: {
        name: '王小明',
        education: [{ school: '四川大学', major: '计算机科学', degree: '本科', year: 2020 }],
        experience: [{ company: '腾讯', title: '前端工程师', duration: '2020-2023', highlights: ['React', 'TypeScript'] }],
        skills: ['React', 'TypeScript', 'Node.js', 'Python'],
        matchScore: 0.85,
      },
    });
  }),

  http.post(`${API_BASE}/ai/match`, async ({ request }) => {
    await delay(800);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: {
        jobId: body.jobId,
        matches: mockCandidates.slice(0, 5).map((c, i) => ({
          candidateId: c.id,
          name: c.name,
          score: 0.95 - i * 0.05,
          reasons: ['技能匹配度高', '经验年限符合', '行业背景相关'],
        })),
      },
    });
  }),

  http.post(`${API_BASE}/ai/risk/detect`, async () => {
    await delay(600);
    return HttpResponse.json({
      success: true,
      data: {
        riskLevel: 'low',
        factors: [
          { type: 'resume_consistency', score: 0.92, detail: '简历信息一致性良好' },
          { type: 'employment_gap', score: 0.88, detail: '无明显空窗期' },
        ],
      },
    });
  }),
];

// ─── Extended Domain Handlers (Pipeline, Graph, Sourcing, etc.) ─────────────

const extendedHandlers = [
  // Pipeline（使用mock-data.ts的pipelineCandidates）
  http.get(`${API_BASE}/pipeline/candidates`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    return HttpResponse.json({ success: true, data: paginate(pipelineCandidates, page, pageSize) });
  }),

  http.patch(`${API_BASE}/pipeline/candidates/:id/stage`, async ({ request, params }) => {
    await delay(200);
    const body = await request.json() as Record<string, unknown>;
    const candidate = pipelineCandidates.find(c => c.id === params.id);
    if (candidate) {
      return HttpResponse.json({ success: true, data: { ...candidate, stage: body.stage } });
    }
    return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '候选人不存在' } }, { status: 404 });
  }),

  // Graph（知识图谱）
  http.get(`${API_BASE}/graph/nodes`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: graphNodes });
  }),

  http.get(`${API_BASE}/graph/edges`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: graphEdges });
  }),

  // Sourcing（AI寻访）
  http.get(`${API_BASE}/sourcing/results`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(sourcingResults, page, pageSize) });
  }),

  http.post(`${API_BASE}/sourcing/contact/:id`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { contacted: true, contactedAt: now() } });
  }),

  // Interview Sessions（AI面试会话）
  http.get(`${API_BASE}/interview-sessions`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(interviewSessions, page, pageSize) });
  }),

  // Endorsement Cards（信任背书卡）
  http.get(`${API_BASE}/endorsements`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(endorsementCards, page, pageSize) });
  }),

  http.post(`${API_BASE}/endorsements/:id/verify`, async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { verified: true, verifiedAt: now() } });
  }),

  // Expert Reviews（专家评审）
  http.get(`${API_BASE}/expert/reviews`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(expertReviews, page, pageSize) });
  }),

  http.post(`${API_BASE}/expert/reviews/:id/submit`, async ({ request }) => {
    await delay(400);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: generateId(), status: 'completed', scores: body.scores, submittedAt: now() } });
  }),

  // Succession Planning（继任规划）
  http.get(`${API_BASE}/succession/plan`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: successionPlan });
  }),

  http.get(`${API_BASE}/succession/slots`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: successionSlots });
  }),

  // Talent Commons（人才共享大厅）
  http.get(`${API_BASE}/talent-commons`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(talentCommons, page, pageSize) });
  }),

  // Decision Proposals（决策提案）
  http.get(`${API_BASE}/decisions/proposals`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json({ success: true, data: paginate(decisionProposals, page, pageSize) });
  }),

  http.post(`${API_BASE}/decisions/proposals/:id/approve`, async ({ params }) => {
    await delay(300);
    const proposal = decisionProposals.find(p => p.id === params.id);
    return HttpResponse.json({ success: true, data: { ...proposal, status: 'approved' } });
  }),

  http.post(`${API_BASE}/decisions/proposals/:id/reject`, async ({ params }) => {
    await delay(300);
    const proposal = decisionProposals.find(p => p.id === params.id);
    return HttpResponse.json({ success: true, data: { ...proposal, status: 'rejected' } });
  }),

  // Decision Lineage（决策血统追溯）
  http.get(`${API_BASE}/decisions/lineage/:id`, async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: decisionLineage });
  }),

  // Org Health Metrics（组织健康指标）
  http.get(`${API_BASE}/org/health-metrics`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: orgHealthMetrics });
  }),

  // SSE Events（实时事件流）
  http.get(`${API_BASE}/events/stream`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: sseEvents });
  }),
];

// ─── Health Handler ─────────────────────────────────────────────────────────

const healthHandlers = [
  http.get(`${API_BASE}/health`, async () => {
    return HttpResponse.json({
      status: 'healthy',
      version: '5.0.0',
      timestamp: now(),
      services: { database: 'connected', redis: 'connected', trustGateway: 'operational' },
    });
  }),
];

// ─── Export All Handlers ────────────────────────────────────────────────────

export const handlers = [
  ...authHandlers,
  ...enterpriseHandlers,
  ...jobHandlers,
  ...applicationHandlers,
  ...interviewHandlers,
  ...trustHandlers,
  ...auditHandlers,
  ...analyticsHandlers,
  ...communityHandlers,
  ...aiHandlers,
  ...extendedHandlers,
  ...healthHandlers,
];
