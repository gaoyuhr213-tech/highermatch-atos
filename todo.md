# HigherMatch PC端 生产级深度打磨 TODO

## Phase 2 — 审计基线更新
- [x] 研读《信任传导架构》与《合作方案》，提取核心约束
- [x] 更新REFERENCE_NOTES.md
- [x] 创建todo.md并明确P0/P1/P2补强范围

## Phase 3 — 信任链路与政企合规（P0级）
- [x] 新增「信任传导链路」全局可视化组件（TrustChainVisualizer）
- [x] 新增「CA认证标识」蓝标组件，在企业卡片/岗位列表全局显示
- [x] U盾登录成功后显示「CA认证真实企业」身份标识
- [x] 新增「岗位真实答疑」模块页面（企业发布真实工作内容/薪资结构）
- [x] 操作审计日志UI页面（可追溯、可审计）
- [x] 租户隔离可视化说明组件
- [x] ScopedToken授权流程完善（人才共享大厅）

## Phase 4 — PC优先业务能力补强（P1级）
- [x] B端「同行互助圈」决策社区页面（HR交流招聘经验）
- [x] C端「求职决策社区」页面（选offer/转行决策陪伴）
- [x] 内容审核前置+实名理性社区（无匿名情绪宣泄，Feature Flag标注）
- [x] 「招聘提效看板」数据页面（到面率/入职转化率/平均招聘周期）
- [x] 认证企业vs非认证企业投递率对比图表
- [x] 试点数据采集与效果分析面板

## Phase 5 — 工程质量与安全文档
- [x] 等保合规说明文档
- [x] CA接口对接说明文档（单一接口替换为真实政务网关步骤）
- [x] P0试点SOW文档（W1-W6里程碑、验收标准）
- [x] 部署文档更新（含Vercel/Netlify/本地/OSS四种方式）
- [x] 运维手册

## Phase 6 — 验证与交付
- [x] Vite构建验证通过（零错误）
- [x] 更新AUDIT_REPORT_v3.md（覆盖率→100%）
- [ ] Git推送GitHub v3.0
- [x] 输出最终交付物清单

## Phase 7 — v4.0 审计报告逐条整改（2026-06-12）

### 前端核心整改
- [x] 删除死代码 useAppStore.ts
- [x] 删除死代码 SSEFeed.tsx
- [x] 统一状态管理 → useReducer+Context (src/store/index.ts)
- [x] 路由级React.lazy code split
- [x] 全局ErrorBoundary组件
- [x] 加载/空/错三态StateViews组件

### Trust Layer生产化
- [x] 重写crypto.ts（Web Crypto SM3/HMAC-SHA256 JWT）
- [x] 重写mock适配器（真实哈希+JWT签名）
- [x] 新增SCCA生产适配器骨架
- [x] 重写Gateway（环境切换+k-匿名守卫）

### 后端服务补齐
- [x] Express服务入口 server/index.ts
- [x] 认证中间件 auth.ts
- [x] 租户隔离中间件 tenant.ts
- [x] 错误处理中间件 error.ts
- [x] 限流中间件 rateLimit.ts
- [x] 请求日志中间件 logger.ts
- [x] Trust路由（CA认证/存证）
- [x] Hiring路由（岗位/候选人/面试/决策）
- [x] Audit路由（审计日志）
- [x] AI路由（简历解析/匹配/评分/风险）
- [x] Health路由（健康检查）
- [x] 数据库Schema（8表+9索引）

### 安全测试CI/CD
- [x] 14项单元测试全量通过
- [x] Dockerfile（多阶段+非root+HEALTHCHECK）
- [x] docker-compose.yml（PG+Redis+Backend+Nginx）
- [x] nginx.conf（安全头+gzip+API代理）
- [x] .github/workflows/ci.yml

### 文档与交付
- [x] AUDIT_SELFCHECK_v4.md 自检报告
- [x] Vite构建零错误验证
- [x] vitest 14/14 通过

## Phase 8 — P0最紧迫三项补强（北美对标）

### A. Design System组件库
- [ ] Button组件（Primary/Secondary/Ghost/Danger + size + loading + disabled）
- [ ] Input组件（Text/Password/Search + validation + error state）
- [ ] Select组件（单选/多选 + 搜索 + 异步加载）
- [ ] Badge组件（status/count/dot variants）
- [ ] Avatar组件（image/initials/fallback）
- [ ] Modal组件（确认/表单/全屏 + 键盘ESC关闭）
- [ ] Toast/Notification组件（success/error/warning/info + auto dismiss）
- [ ] Tooltip组件（hover trigger + placement）
- [ ] DataTable组件（排序/筛选/分页/行选择/批量操作）
- [ ] Tabs组件（水平/垂直 + 路由联动）
- [ ] Card组件（header/body/footer + hover效果）
- [ ] Dropdown组件（菜单/操作列表）
- [ ] Skeleton骨架屏组件（文本/卡片/表格/头像）
- [ ] Progress组件（线性/环形/步骤）
- [ ] Tag组件（可关闭/颜色/图标）
- [ ] Divider组件
- [ ] Empty空状态组件
- [ ] Spinner加载组件
- [ ] PageHeader页头组件
- [ ] CommandPalette命令面板（Cmd+K）

### B. 数据获取层
- [ ] 安装React Query + Axios
- [ ] 创建typed API Client（baseURL + interceptors + token注入）
- [ ] 创建API hooks层（useJobs/useCandidates/useInterviews等）
- [ ] 迁移所有页面从mock-data到API hooks
- [ ] 实现乐观更新（Optimistic Update）
- [ ] 实现请求缓存与失效策略
- [ ] 创建MSW mock server（开发环境API模拟）

### C. 认证体系完整实现
- [ ] 服务端JWT签发端点（/api/v1/auth/login）
- [ ] Token刷新端点（/api/v1/auth/refresh）
- [ ] U盾Challenge-Response服务端流程
- [ ] RBAC权限矩阵（admin/hr/interviewer/candidate）
- [ ] 权限守卫中间件（路由级+API级）
- [ ] 前端AuthContext + ProtectedRoute
- [ ] Session并发控制（单设备/多设备策略）
- [ ] PIN锁定服务端状态维护
- [ ] 登出+Token黑名单

### D. GitHub推送
- [ ] 推送v4.0代码到gaoyuhr213-tech/highermatch-atos
- [ ] 推送P0补强后的最新代码
