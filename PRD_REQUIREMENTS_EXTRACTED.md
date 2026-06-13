# PRD 关键需求摘要（从PDF提取）

## 1. 技术栈与基线
- Vite 8 + React 19 + TypeScript + Tailwind 3 + react-router-dom 6 + framer-motion + recharts + @dnd-kit + lucide-react
- 数据来自 src/data/mock-data.ts，扩充为支撑全演示路径
- 纯前端SPA，Mock模拟，无真实后端/国密/CA接口

## 2. 入场真实路径（§2.1 已验收，必须1:1实现）
- 证书助手标准界面 → 点击右侧"模拟插入数字证书" → 识别企业身份(蜀道集团·EV·SN...) → 蓉才通图标点亮+"点击进入"角标 → 点击蓉才通独立图标 → 可信入场(国密校验:校验数字证书EV→OCSP:Good→建立可信会话) → 蓉才通产品首页(认证态)
- 未插证书前点击蓉才通 → 抖动+"请先插入数字证书"提示
- 桌面原生：鼠标hover、右键菜单、键盘快捷键；禁用移动端swipe

## 3. Design Tokens（自包含）
- Brand/AI蓝(600=#2563EB):50 #EEF4FF:100 #D9E5FF:200 #BCD0FF:300 #8FB1FF:400 #5E8BFB:500 #3B6FF2:600 **#2563EB**:700 #1D4FD0:800 #1E45A8:900 #1E3A82:950 #172554
- Ink/冷中性:0 #FFF:50 #F8FAFC:100 #F1F4F8:200 #E3E8EF:300 #CDD5E0:400 #9AA6B8:500 #697586:600 #4B5565:700 #364152:800 #202939:900 #121926:950 #0B0F1A
- 语义:trust #059669/#ECFDF5/#A7F3D0:risk #DC2626/#FEF2F2/#FECACA:warn #D97706/#FFFBEB/#FDE68A
- Seal:EV #047857(金属渐变边):OV #2563EB:DV #697586
- 字体:sans Inter,"PingFang SC","Microsoft YaHei"; mono **Geist Mono**(哈希/序列号/签名/版本号)
- 字阶:h1 30/600:h2 24/600:h3 20/600:body **14/400**:label 13/500:caption 12:overline 11/600/大写:mono 13/tabular
- 间距:4基:圆角 投钮/输入10:卡片16:全圆999:阴影 1px hairline + e2(卡)/e3(浮层)/e4(模态)
- 焦点:focus ring 0 0 0 3px rgba(37,99,235,.18)
- 动效:fast140:base200:slow320:ceremony800(签名)
- ease standard cubic-bezier(.2,0,0,1):fluid cubic-bezier(.22,1,.36,1)
- 密度:comfortable 行高44(默认)/compact 36(表格/看板)
- 全局 tabular-nums:主题:工作台浅色优先;入场/验真深色仪式

## 4. 信息架构/路由
- 入场(无登录态): 证书助手仿真 → 可信入场 → 首页(§5)
- B端(雇主/HRD): /home /command /pipeline /graph /sourcing /interview /job-qa /community /efficiency /audit
- C端(候选人): /c/coach /c/apply /c/endorsement /c/decision-hub
- 专家端: /expert/reviews /expert/rewards
- 国企端: /soe/succession /soe/commons
- 公开(无登录): /e/:slug 背书验真页(官网级)
- 全局: Cmd-K命令面板:决策血统抽屉:顶栏身份芯片
- 角色切换:顶栏角色下拉(B/C/Expert/SOE), Demo演示用

## 5. 入场模型（证书助手仿真+可信入场+首页）
### 5.1 证书助手仿真屏(对照HTML还原1:1)
- 标准皮肤(白底):顶栏 红盾"证书助手"+ 当前版本1.3.7 + 客服400-028-1130 + ≡—× + 角标"演示环境·模拟"
- 左导航6项:首页(红,active)/证书业务/应用中心/环境检测/客户服务/在线升级
- 推荐应用(5):四川人社·四川省公共资源·四川政府采购·成都公积金·四川政务服务网(白底磁贴+彩色logo+下方签)
- 福利专区(5+1):工资查询·人效云·智能招聘助手·证书用户专享·特转新辅导 +「蓉才通」独立新图标(角标"新")
- 右侧:「请插入您的数字证书」红框 + 笔记本/U盾线性插画 +「模拟插入数字证书」按钮
- 公告栏(真实条目+日期) + 底部SCCA中心署名 + www.scca.com.cn
- 第三方logo为占位，预留可替换为官方PNG的接口(图片插槽)
- AC:□ 与HTML还原视觉一致 □ 标注"模拟" □ §2.1交互路径完整 □ 未插证书点蓉才通抖动提示

### 5.2 可信入场splash
- 1.5–2s:校验数字证书(EV)→OCSP:Good→建立可信会话 逐项点亮 + 企业名/EV印章
- reduced-motion直显。AC:□ 替换原5步登录 □ 蓉才通内无PIN/插盾画面

### 5.3 产品首页 /home(认证态Landing, 回应"官网形式")
- 顶栏 IdentityChip(蜀道集团·EV·四川CA可信) + OperatorBadge(张某·财务总监)
- 欢迎区:欢迎，蜀道集团 + 可信身份行(EV·统一社会信用代码 mono·经四川CA验证 + 操作人行(分开))
- 角色入口大卡(决策总控台/招聘流水线/人才图谱/AI寻访) + 今日聚焦(高优 DecisionCard 1–2)
- AC:□ 按英雄页打磨(首因) □ 身份/操作人分行 □ 点"决策总控台"进 /command

## 6. 组件库(components/ui/*, 先建)
- 原子:Button(primary/secondary/ghost/danger/seal;sm32/md36/lg40;hover/active/focus/loading):Input:Card(hairline+xl16+e2):Badge/Pill:Avatar:Skeleton:Toast(含sign-confirmed印章态):Tabs:Tooltip:Drawer(右480):Modal:EmptyState
- 信任/业务(重点打磨):
  - CABadge:inline/chip/seal:EV金属/OV蓝/DV灰:verified/pending/expired/revoked:hover Tooltip(序列号·有效期·SM3(mono可复制)·扫码验真)
  - IdentityChip/OperatorBadge:顶栏常驻,企业身份 vs 操作人语义分离
  - SignCeremony:idle→signing(进度环)→stamped(印章spring+glow)→attested(SM3逐字打出)→Toast「已存证·司法级」;ceremony800;reduced-motion降级。回执含签名主体(企业U盾)+操作人
  - DecisionCard(桌面交互):左键=审批(触发SignCeremony)/右键菜单=暂缓;淘汰:下钻/双击=下钻血统/键盘A:S:解剖type徽标+候选人/岗位+置信度+风险pill+证据chip+model/prompt(mono)+已盖印章;状态pending/approved/rejected/suspended
  - KPICard:overline+大数(mono tabular)+趋势chip(按指标方向语义,如Time-to-Hire↓=好)+sparkline
  - DataTable:sticky表头:排序:列宽拖拽:密度切换:送中态:内嵌CABadge/风险热力:三态
  - LineageGraph:纵向DAG(阶段节点)+证据蝇(positive绿/counter/琥珀)+model/prompt(mono)+SM3(mono)+顶部整体SM3+反向证据列:每条同时显示 签名主体+操作人;揭示stagger
  - CommandPalette(Cmd-K):导航/操作(审批·暂缓·导出·切角色)/搜索候选人;键盘+模糊匹配;键位⌘K·Ctrl+L血统·Ctrl+E导出·?·J/K·A·S
  - TrustChainVisualizer:U盾→CA→企业标识→岗位→候选人 信任传导链路(升级现有组件)
  - SSEFeed:补实现,决策卡片实时流(Demo用setInterval模拟,标注)

## 7. 全部页面逐页PRD
### B端
- 7.1 决策总控台 /command: 控制室,组织健康+待决策+实时流。布局:左 待决策队列(DecisionCard列)/中KPI网格(6卡+sparkline)+组织健康/右SSE实时流(high红点脉冲);顶Tabs:决策·Flags·报表。真实交互:DecisionCard三桌面操作;高优"战略人才补给"提案卡一键执行→跳/pipeline;Ctrl+E导出。状态:空"暂无高优提案"引导;截粒子骨架;错阶级静态+重试。Mock:6决策提案,6KPI(TQDV/签名占比/Time-to-Hire/解析准确率/人工干预频率/图谱增速),SSE事件流。AC:□ KPI mono+趋势按方向 □ 一键执行进Pipeline □ SSE新事件滑入高亮
- 7.2 招聘流水线 /pipeline: 自主招聘Kanban。布局:6列(Sourcing→Screening→Interviewing→RiskCheck→Offering→Signed)。@dnd-kit拖拽。SuspendGate=挂起列加锁+蒙层+原因。拖入触发"需U盾解除"抖动;多选→底部浮动条(移动/淘汰/导出CSV带BOM);密度切换;卡内CABadge+风险热力。状态/Mock:各列若干候选人卡。AC:□ 拖拽顺滑 □ SuspendGate视觉+拦截 □ 批量条 □ 桌面右键菜单
- 7.3 人才图谱 /graph: 可信关系图谱。布局:全屏canvas/SVG,四类节点四色四glyph(talent/company/skill/position)。真实交互:CA签名边=实线trust绿+撤回印章/未签=虚线ink-300;高潜brand光晕;风险red脉冲;hover halo;点击节点→右Drawer详情;focus模式非邻居降透15;浮动玻璃控制条(圆层/过滤/搜索)。状态:空导入引导;提供键盘可达列表替代视图(a11y)。Mock:~12节点+签名/未签名。AC:□ 签名边/未签名可辨 □ 节点下钻 □ 列表替代视图
- 7.4 AI寻访 /sourcing: 全网穿透寻访。布局:搜索框(自然语言)+候选人池表(DataTable)。真实交互:输入指令→结果入池(配色演示主线,节点长入图谱);导出CSV;触达草稿需操作人审核。状态/Mock:候选人列表。AC:□ 自然语言入池 □ 导出
- 7.5 AI异步面试 /interview: 动态追问+评分。布局:左 对话流(AI追问/候选人/系统 三色气泡+打字机)+证据高亮/右 实时信号(5维雷达+三通道meter)+真实性柱;顶 轮次+时延。真实交互:逐轮追问→3min"结算"出硬/软技能矩阵。Mock:面试脚本+评分(标注Mock)。AC:□ 打字机+雷达 □ 结算动效
- 7.6 岗位答疑 /job-qa: CA实名岗位真实答疑(信任经济)。布局:问答卡片流(提问者带CABadge)。真实交互:发问/回答:企业蓝标可信背书。Mock:问答数据。AC:□ 提问者CABadge □ 信任标识
- 7.7 决策互助圈 /community: B端实名理性决策社区。布局:帖子流(脱敏/实名标识)+话题。Mock:社区帖。AC:□ 实名/脱敏标识 □ 列表三态
- 7.8 招聘提效看板 /efficiency: 到面率/入职转化/招聘周期。布局:KPICard+recharts图。真实交互:时间区间切换。Mock:指标(标注【待验证】真实数据)。AC:□ 趋势按方向语义 □ 图表hairline网格+tabular
- 7.9 审计日志 /audit: 不可篡改审计。布局:DataTable(时间·操作人·动作·correlationId·签名主体)。真实交互:筛选/下钻血统(Ctrl+L)。Mock:审计流,每条记签名主体+操作人。AC:□ 签名主体/操作人分列 □ correlationId可下钻
- 7.10 决策血统抽屉(全局): §6 LineageGraph,右抽屉560,顶部整体SM3+底部"导出司法存证报告"。AC:□ 证据+反向证据 □ 模型/Prompt版本 □ 签名主体+操作人

### C端(候选人,可深色聚光)
- 7.11 AI Job Coach /c/coach: 简历调优(STAR,严禁编造)+模拟面试+薪酬博弈建议。AC:□ 调优不编造 □ 模拟面试
- 7.12 智能投递 /c/apply: 岗位匹配+一键投递(未实名限制→引号CA实名)。AC:□ 匹配命中 □ 实名门槛
- 7.13 背书卡片 /c/endorsement: 生成CA签名背书卡片(状态机generated→signed→shared→verified)+分享。AC:□ 状态机 □ 生成QR
- 7.14 决策社区(C端) /c/decision-hub: 决策陪伴+实名理性讨论。AC:□ 实名标识

### 专家端
- 7.15 匿名评审 /expert/reviews: 脱敏材料匿名星评+点评(入证据链);超时改派。AC:□ 脱敏 □ 评语入血统
- 7.16 积分激励 /expert/rewards: 评审积分/权益。AC:□ 积分明细

### 国企端
- 7.17 继任沙盘 /soe/succession: 高潜板凳/梯队A/B+继任者推荐卡(干部画像)。Mock样本(标注P2)。AC:□ 梯队视图
- 7.18 信调共享 /soe/commons: 可信借调流+ScopedToken只读视图(原始数据不迁移)。AC:□ ScopedToken授权可视

### 公开
- 7.19 背书验真公开页 /e/:slug(官网级·唯一对外翻窗)
  - 无登录·深色仪式底;居中大号EV印章+候选人/岗位+签发企业CABadge+四川CA权威锁;信任证据SM2(mono可复制)·SM3·签发时间·验真次数;大"扫码/点击验真"→ceremony;底部克制CTA反向引流(Stripe回执页精度)。AC:□ 无登录可访问 □ 验真ceremony □ 移动端自适应

## 8. U盾可信脊梁+签名主体vs操作人
- 脊梁:① 顶栏IdentityChip常驻;② 操作即签名——发岗/审批/签发背书→调起证书助手签名(Demo模拟SignCeremony)→回执;③ 高敏重签"请在证书助手中确认";④ 会话失效回证书助手
- 治理:签名主体=企业(法人U盾SM2)/操作人=登录人(可能财务总监);血统/审计/背书同时记两者并分行:签名：蜀道集团(企业U盾·SM2:3a7f_)/操作人：张某·财务总监(席位授权)/correlationId

## 9. 信任调用链(接通现有lib/trust)
- 建 useTrustedSession():Demo注入mock身份{enterprise:'蜀道集团',operator:'张某·财务总监',certLevel:'EV',unifiedCreditCode,scopedToken};入场流写入,全局可读
- 入场/签名/审计走 getCAAdapter()(Mock适配器),而非纯动画——运行期链路真实,生产切换只换Adapter
- 【待验证】:真实handoff协议(证书助手SSO/中间件),产品内调起签名接口,真实国密SM2/SM3+CA联调

## 10. 动效/状态/可访问性/数字
- 动效:页面进opacity+y8(base);列表stagger40;签名仪式见§6;SuspendGate拒拖shake;图谱focus;SSE入场高亮渐隐;reduced-motion全降级
- 状态:每页Empty(图标+一句+CTA)/Loading(骨架shimmer)/Error(行内降级+重试,整页ErrorBoundary)
- a11y(WCAG AA):对比≥4.5:1;全键盘+focus ring;图谱列表替代视图;200%字号;图标按钮aria-label;SSE/Toast aria-live
- 数字:tabular-nums+千分位;哈希/序列号/签名/版本号mono+可复制;时间相对+hover绝对

## 11. Mock数据约定/Real vs Demo(如实标注,防能力误判)
- 全部数据来自mock-data.ts(扩充以支撑§2.2主线)。所有模拟元素必须可标注:证书助手仿真、handoff、SM2/SM3值、SSE、AI评分、第三方logo、推演/继任沙盘=【Demo/Mock】

## 12. Manus执行计划
- 构建顺序:
  - P0 地基: tokens/tailwind/字体+ui原子(Button/Input/Card/Badge/Avatar/Skeleton/Toast)
  - P1 信任: CABadge→SignCeremony→IdentityChip/OperatorBadge→TrustChainVisualizer
  - P2 入口: 证书助手仿真(对照HTML)→可信入场→产品首页 ← 客户演示最先看到,最优先
  - P3 数据: DataTable→KPICard→DecisionCard(桌面)→CommandPalette→SSEFeed补实现
  - P4 主线: 决策总控台→Pipeline→Sourcing→Interview→决策血统抽屉(打通§2.2一镜到底)
  - P5 其余B: Graph→JobQA→Community→Efficiency→Audit
  - P6 多端: C端(Coach/Apply/Endorsement/DecisionHub)→专家端→国企
  - P7 公开: 背书验真页(官网级)
  - P8 收尾: 三态+a11y+reduced-motion+暗色+路由级code-split+演示主线连贯性回归

## App Shell规格
- Sidebar 264(可折叠64) + TopBar 56(面包屑·Cmd-K搜索·组织健康微指标:IdentityChip+OperatorBadge) + Content bg-app
