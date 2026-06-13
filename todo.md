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
- [x] Button组件（Primary/Secondary/Ghost/Danger + size + loading + disabled）
- [x] Input组件（Text/Password/Search + validation + error state）
- [x] Select组件（单选/多选 + 搜索 + 异步加载）
- [x] Badge组件（status/count/dot variants）
- [x] Avatar组件（image/initials/fallback）
- [x] Modal组件（确认/表单/全屏 + 键盘ESC关闭）
- [x] Toast/Notification组件（success/error/warning/info + auto dismiss）
- [x] Tooltip组件（hover trigger + placement）
- [x] DataTable组件（排序/筛选/分页/行选择/批量操作）
- [x] Tabs组件（水平/垂直 + 路由联动）
- [x] Card组件（header/body/footer + hover效果）
- [x] Dropdown组件（菜单/操作列表）
- [x] Skeleton骨架屏组件（文本/卡片/表格/头像）
- [x] Progress组件（线性/环形/步骤）
- [x] Tag组件（可关闭/颜色/图标）
- [x] Divider组件
- [x] Empty空状态组件
- [x] Spinner加载组件
- [x] PageHeader页头组件
- [x] CommandPalette命令面板（Cmd+K）

### B. 数据获取层
- [x] 安装React Query + Axios
- [x] 创建typed API Client（baseURL + interceptors + token注入）
- [x] 创建API hooks层（useJobs/useCandidates/useInterviews等）
- [ ] 迁移所有页面从mock-data到API hooks
- [x] 实现乐观更新（Optimistic Update）
- [x] 实现请求缓存与失效策略
- [ ] 创建MSW mock server（开发环境API模拟）

### C. 认证体系完整实现
- [x] 服务端JWT签发端点（/api/v1/auth/login）
- [x] Token刷新端点（/api/v1/auth/refresh）
- [x] U盾Challenge-Response服务端流程
- [x] RBAC权限矩阵（admin/hr_manager/hr_specialist/interviewer/candidate/auditor）
- [x] 权限守卫中间件（路由级RouteGuard + API级auth middleware）
- [x] 前端AuthContext + RouteGuard
- [x] Session并发控制（自动Token刷新+过期处理）
- [x] PIN锁定服务端状态维护（via U盾Agent）
- [x] 登出+Token清除

### D. GitHub推送
- [x] 推送v4.0代码到gaoyuhr213-tech/highermatch-atos
- [x] 推送P0补强后的最新代码
- [x] 推送AI Capability Sprint 1代码

---

## Phase 9 — 前端高保真Demo增量升级（PRD v1.0 全量落地）

### P0 设计系统与工程基础
- [x] 新增 src/styles/tokens.css 全局设计变量（品牌色/中性色/语义色/证书印章色/字体/字阶/间距/圆角/阴影/焦点/motion token）
- [x] 扩展 Tailwind 语义别名，禁止组件硬编码色值
- [x] 补充全局字体栈：Inter/PingFang SC/Microsoft YaHei/Geist Mono + tabular-nums
- [x] 完成 reduced-motion 与 color-scheme 适配
- [x] 整合状态管理（保留useReducer+Context，清理残余）
- [x] 补全 SSEFeed 组件并接入 Demo 事件流
- [x] 接通 lib/trust 信任调用链 + useTrustedSession + mock CA adapter

### P1 入场流程（最高优先级）
- [x] 1:1还原证书助手标准界面（顶部栏/左侧导航/推荐应用/福利专区/蓉才通图标/右侧证书操作区/公告栏/底部版权/演示环境标识）
- [x] 完整实现入场链路：模拟插入证书→企业身份识别→蓉才通图标点亮→可信入场Splash→认证态首页
- [x] 未插证书点击蓉才通：抖动反馈+文字提示
- [x] 可信入场Splash校验步骤逐项点亮动效 + reduced-motion降级
- [x] 替换原有登录页/U盾PIN画面，产品内部不再保留旧登录入口

### P1 App Shell 与全局组件
- [x] 升级全局App Shell：侧边栏（折叠）+顶部导航栏+内容区，适配所有现有页面
- [x] 完整实现原子组件 components/ui（Button/Input/Card/Badge/Avatar/Skeleton/Toast/Tooltip/Drawer/Modal/EmptyState）
- [x] 实现业务组件（CABadge/IdentityChip/OperatorBadge/SignCeremony/DecisionCard/KPICard/DataTable/LineageGraph/CommandPalette/TrustChainVisualizer/SSEFeed）
- [x] 核心组件补齐多状态+键盘交互+Tooltip+抽屉/弹窗规则
- [x] 签名仪式/决策血统/信任链路特色动效与状态机

### P2 页面高保真改版：B端
- [x] /home 产品首页（身份态Landing/角色入口/DecisionCard/可信身份）
- [x] /command 决策总控台（决策队列/KPI网格/组织健康/SSE事件流/Tabs/快捷键/批量操作）
- [x] /pipeline 招聘流水线（6列拖拽/SuspendGate/CABadge/风险热力/多选/批量）
- [x] /graph 人才图谱（全屏/CA签名边高亮/右击抽屉/a11y列表替代）
- [x] /sourcing AI寻访（NL输入/候选人表/状态筛选/导出/操作人审批）
- [x] /interview 异步面试（左侧追问/右侧信号时间轴/实时字幕评分/Mock标注）
- [x] /job-qa 岗位答疑（问答卡片流/CABadge/信任标识）
- [x] /community 决策社区（实名/脱敏/列表三态）
- [x] /efficiency 提效看板（KPI+recharts/时间区间/tabular）
- [x] /audit 审计日志（DataTable/correlationId/签名主体+操作人下钻）
- [x] 全局决策血统抽屉（证据/反向证据/模型/Prompt版本/签名主体/操作人）

### P2 页面高保真改版：C端/专家端/国企端/公开页
- [x] /c/coach AI Job Coach
- [x] /c/apply 智能投递
- [x] /c/endorsement 背书卡
- [x] /c/decision-hub 决策社区（C端）
- [x] /expert/reviews 匿名评审
- [x] /expert/rewards 积分激励
- [x] /soe/succession 国企继任
- [x] /soe/commons 信调共享
- [x] /e/:slug 公开背书验真页（官网级视觉/无登录/验真动效/反向引流）

### P3 无障碍、兼容性与验收
- [x] 所有页面补齐 Empty/Loading/Error 三态
- [x] WCAG 2.1 AA（键盘/focus ring/对比度/aria-label/live region/图谱替代视图）
- [x] 适配 1440/1920 桌面分辨率
- [x] 路由级 code split + 控制台报错清零
- [x] npm run dev 本地预览全流程可交互无报错
- [x] Mock/Demo/待验证项标注完整
