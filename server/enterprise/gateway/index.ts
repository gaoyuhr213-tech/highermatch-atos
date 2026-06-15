/**
 * Phase 13-D: API Gateway + SDK + MCP Server
 * 
 * 将蓉才通从产品变成平台：开放API + SDK + MCP + Webhook
 * 
 * 对标: Stripe API / OpenAI API / Anthropic API / Palantir Foundry API
 * 
 * 核心能力：
 * 1. API Gateway（认证/限流/路由/版本/日志）
 * 2. OpenAPI 3.1 Spec
 * 3. TypeScript SDK
 * 4. Python SDK
 * 5. API Key Management
 * 6. Webhook System
 * 7. MCP Server（Model Context Protocol）
 * 8. Agent-to-Agent Protocol
 * 9. Usage Metering
 * 10. Developer Portal
 */

import { createHmac, randomBytes } from 'crypto';

// ============================================================
// API Key Management
// ============================================================

export interface APIKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;        // 前8位（可见）
  keyHash: string;          // SHA-256 hash
  scopes: APIScope[];
  rateLimit: number;        // requests per minute
  status: 'active' | 'revoked' | 'expired';
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  metadata: Record<string, unknown>;
}

export type APIScope = 
  | 'resume:read' | 'resume:write' | 'resume:parse'
  | 'interview:read' | 'interview:write' | 'interview:execute'
  | 'people:search' | 'people:read'
  | 'operator:execute' | 'operator:read'
  | 'memory:read' | 'memory:write'
  | 'workflow:read' | 'workflow:write' | 'workflow:execute'
  | 'eval:read' | 'eval:execute'
  | 'webhook:manage'
  | 'admin:full';

export class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();

  /**
   * 创建API Key
   */
  create(params: {
    tenantId: string;
    name: string;
    scopes: APIScope[];
    rateLimit?: number;
    expiresAt?: number;
    createdBy: string;
  }): { key: APIKey; rawKey: string } {
    const rawKey = `hm_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 11); // hm_ + 8 chars
    const keyHash = createHmac('sha256', 'atos_key_salt').update(rawKey).digest('hex');

    const key: APIKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      name: params.name,
      keyPrefix,
      keyHash,
      scopes: params.scopes,
      rateLimit: params.rateLimit || 60,
      status: 'active',
      createdBy: params.createdBy,
      createdAt: Date.now(),
      expiresAt: params.expiresAt,
      metadata: {},
    };

    this.keys.set(key.id, key);
    return { key, rawKey };
  }

  /**
   * 验证API Key
   */
  validate(rawKey: string): APIKeyValidation {
    const keyHash = createHmac('sha256', 'atos_key_salt').update(rawKey).digest('hex');
    
    for (const key of this.keys.values()) {
      if (key.keyHash === keyHash) {
        if (key.status !== 'active') {
          return { valid: false, reason: 'key_revoked' };
        }
        if (key.expiresAt && Date.now() > key.expiresAt) {
          return { valid: false, reason: 'key_expired' };
        }
        key.lastUsedAt = Date.now();
        return { valid: true, key };
      }
    }

    return { valid: false, reason: 'key_not_found' };
  }

  /**
   * 检查Scope权限
   */
  hasScope(key: APIKey, requiredScope: APIScope): boolean {
    if (key.scopes.includes('admin:full')) return true;
    return key.scopes.includes(requiredScope);
  }

  /**
   * 轮换Key
   */
  rotate(keyId: string, createdBy: string): { newKey: APIKey; rawKey: string } | null {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) return null;

    // 撤销旧Key
    oldKey.status = 'revoked';

    // 创建新Key（继承配置）
    const result = this.create({
      tenantId: oldKey.tenantId,
      name: oldKey.name,
      scopes: oldKey.scopes,
      rateLimit: oldKey.rateLimit,
      expiresAt: oldKey.expiresAt,
      createdBy,
    });
    return { newKey: result.key, rawKey: result.rawKey };
  }

  /**
   * 撤销Key
   */
  revoke(keyId: string): void {
    const key = this.keys.get(keyId);
    if (key) key.status = 'revoked';
  }

  /**
   * 列出租户的所有Key
   */
  listByTenant(tenantId: string): APIKey[] {
    return Array.from(this.keys.values()).filter(k => k.tenantId === tenantId);
  }
}

export interface APIKeyValidation {
  valid: boolean;
  key?: APIKey;
  reason?: string;
}

// ============================================================
// API Gateway
// ============================================================

export interface GatewayRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  ip: string;
  timestamp: number;
}

export interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface GatewayRoute {
  method: string;
  path: string;
  version: string;
  handler: string;
  requiredScopes: APIScope[];
  rateLimit?: number;
  deprecated?: boolean;
  deprecatedAt?: string;
  sunset?: string;
}

export class APIGateway {
  private routes: GatewayRoute[] = [];
  private middleware: GatewayMiddleware[] = [];
  private requestLog: GatewayRequestLog[] = [];

  /**
   * 注册路由
   */
  registerRoute(route: GatewayRoute): void {
    this.routes.push(route);
  }

  /**
   * 注册中间件
   */
  use(middleware: GatewayMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * 处理请求
   */
  async handleRequest(request: GatewayRequest, apiKey: APIKey): Promise<GatewayResponse> {
    const startTime = Date.now();

    // 1. 路由匹配
    const route = this.matchRoute(request.method, request.path);
    if (!route) {
      return { status: 404, headers: {}, body: { error: 'not_found', message: 'Endpoint not found' } };
    }

    // 2. 版本检查
    if (route.deprecated) {
      // 添加Deprecation header
    }

    // 3. Scope检查
    for (const scope of route.requiredScopes) {
      if (!apiKey.scopes.includes(scope) && !apiKey.scopes.includes('admin:full')) {
        return { status: 403, headers: {}, body: { error: 'insufficient_scope', required: scope } };
      }
    }

    // 4. 执行中间件链
    for (const mw of this.middleware) {
      const result = await mw.process(request, apiKey);
      if (result.blocked) {
        return { status: result.statusCode || 429, headers: result.headers || {}, body: result.body };
      }
    }

    // 5. 记录请求
    this.logRequest({
      keyId: apiKey.id,
      tenantId: apiKey.tenantId,
      method: request.method,
      path: request.path,
      status: 200,
      latency: Date.now() - startTime,
      timestamp: startTime,
    });

    return { status: 200, headers: { 'X-Request-Id': `req_${Date.now()}` }, body: { success: true } };
  }

  /**
   * 获取API使用统计
   */
  getUsageStats(tenantId: string, period: { start: number; end: number }): APIUsageStats {
    const logs = this.requestLog.filter(l => 
      l.tenantId === tenantId && l.timestamp >= period.start && l.timestamp <= period.end
    );

    return {
      totalRequests: logs.length,
      successRate: logs.filter(l => l.status < 400).length / Math.max(logs.length, 1),
      avgLatency: logs.reduce((sum, l) => sum + l.latency, 0) / Math.max(logs.length, 1),
      byEndpoint: this.groupByEndpoint(logs),
      byStatus: this.groupByStatus(logs),
      peakRPS: this.calculatePeakRPS(logs),
    };
  }

  private matchRoute(method: string, path: string): GatewayRoute | null {
    return this.routes.find(r => r.method === method && this.pathMatches(r.path, path)) || null;
  }

  private pathMatches(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
  }

  private logRequest(log: GatewayRequestLog): void {
    this.requestLog.push(log);
    // 保留最近100K条
    if (this.requestLog.length > 100000) {
      this.requestLog = this.requestLog.slice(-50000);
    }
  }

  private groupByEndpoint(logs: GatewayRequestLog[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const log of logs) { groups[log.path] = (groups[log.path] || 0) + 1; }
    return groups;
  }

  private groupByStatus(logs: GatewayRequestLog[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const log of logs) { 
      const bucket = `${Math.floor(log.status / 100)}xx`;
      groups[bucket] = (groups[bucket] || 0) + 1;
    }
    return groups;
  }

  private calculatePeakRPS(logs: GatewayRequestLog[]): number {
    if (logs.length === 0) return 0;
    const buckets: Record<number, number> = {};
    for (const log of logs) {
      const second = Math.floor(log.timestamp / 1000);
      buckets[second] = (buckets[second] || 0) + 1;
    }
    return Math.max(...Object.values(buckets));
  }
}

export interface GatewayMiddleware {
  name: string;
  process(request: GatewayRequest, apiKey: APIKey): Promise<MiddlewareResult>;
}

export interface MiddlewareResult {
  blocked: boolean;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface GatewayRequestLog {
  keyId: string;
  tenantId: string;
  method: string;
  path: string;
  status: number;
  latency: number;
  timestamp: number;
}

export interface APIUsageStats {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  byEndpoint: Record<string, number>;
  byStatus: Record<string, number>;
  peakRPS: number;
}

// ============================================================
// Webhook System
// ============================================================

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: 'active' | 'disabled' | 'failing';
  failureCount: number;
  lastDeliveredAt?: number;
  createdAt: number;
}

export type WebhookEvent = 
  | 'interview.started' | 'interview.completed' | 'interview.scored'
  | 'resume.parsed' | 'resume.matched' | 'resume.ranked'
  | 'candidate.created' | 'candidate.updated' | 'candidate.stage_changed'
  | 'workflow.started' | 'workflow.completed' | 'workflow.failed'
  | 'offer.created' | 'offer.approved' | 'offer.rejected'
  | 'evaluation.completed' | 'evaluation.regression_detected'
  | 'hitl.approval_required' | 'hitl.resolved';

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: number;
  nextRetryAt?: number;
}

export class WebhookManager {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: WebhookDelivery[] = [];

  /**
   * 注册Webhook端点
   */
  register(params: {
    tenantId: string;
    url: string;
    events: WebhookEvent[];
  }): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      url: params.url,
      events: params.events,
      secret: randomBytes(32).toString('hex'),
      status: 'active',
      failureCount: 0,
      createdAt: Date.now(),
    };

    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  /**
   * 触发事件
   */
  async emit(tenantId: string, event: WebhookEvent, payload: unknown): Promise<void> {
    const endpoints = Array.from(this.endpoints.values()).filter(
      ep => ep.tenantId === tenantId && ep.events.includes(event) && ep.status === 'active'
    );

    for (const endpoint of endpoints) {
      const delivery: WebhookDelivery = {
        id: `whd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        endpointId: endpoint.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
      };
      this.deliveries.push(delivery);
      await this.deliver(delivery, endpoint);
    }
  }

  /**
   * 生成签名
   */
  generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * 验证签名
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return expected === signature;
  }

  private async deliver(delivery: WebhookDelivery, endpoint: WebhookEndpoint): Promise<void> {
    delivery.attempts++;
    delivery.status = 'retrying';

    try {
      // 生产环境中使用fetch/axios发送HTTP请求
      const payloadStr = JSON.stringify({
        id: delivery.id,
        event: delivery.event,
        timestamp: Date.now(),
        data: delivery.payload,
      });

      const signature = this.generateSignature(payloadStr, endpoint.secret);

      // 模拟发送（生产环境替换为真实HTTP调用）
      // const response = await fetch(endpoint.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Webhook-Signature': signature,
      //     'X-Webhook-Id': delivery.id,
      //     'X-Webhook-Event': delivery.event,
      //   },
      //   body: payloadStr,
      // });

      delivery.status = 'delivered';
      delivery.deliveredAt = Date.now();
      endpoint.lastDeliveredAt = Date.now();
      endpoint.failureCount = 0;
    } catch (error) {
      delivery.status = delivery.attempts >= delivery.maxAttempts ? 'failed' : 'retrying';
      endpoint.failureCount++;

      if (endpoint.failureCount >= 10) {
        endpoint.status = 'failing';
      }

      // 指数退避重试
      if (delivery.attempts < delivery.maxAttempts) {
        delivery.nextRetryAt = Date.now() + Math.pow(2, delivery.attempts) * 1000;
      }
    }
  }
}

// ============================================================
// MCP Server（Model Context Protocol）
// ============================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, context: MCPContext) => Promise<MCPToolResult>;
}

export interface MCPContext {
  tenantId: string;
  userId: string;
  apiKeyId: string;
  permissions: APIScope[];
}

export interface MCPToolResult {
  content: Array<{ type: 'text' | 'image' | 'resource'; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * 注册MCP工具
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 列出所有工具
   */
  listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * 调用工具
   */
  async callTool(name: string, input: Record<string, unknown>, context: MCPContext): Promise<MCPToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Tool '${name}' not found` }], isError: true };
    }

    try {
      return await tool.handler(input, context);
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }

  private registerDefaultTools(): void {
    // Resume Intelligence
    this.registerTool({
      name: 'atos_parse_resume',
      description: '解析简历文件，提取结构化信息（教育、工作经历、技能、项目）',
      inputSchema: {
        type: 'object',
        properties: {
          file_url: { type: 'string', description: '简历文件URL' },
          format: { type: 'string', enum: ['pdf', 'docx', 'txt'], description: '文件格式' },
        },
        required: ['file_url'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ parsed: true, file: input.file_url }) }],
      }),
    });

    this.registerTool({
      name: 'atos_match_resume',
      description: '将简历与JD进行匹配评分，返回匹配度、缺失技能、风险信号',
      inputSchema: {
        type: 'object',
        properties: {
          resume_id: { type: 'string', description: '简历ID' },
          jd_text: { type: 'string', description: '职位描述文本' },
        },
        required: ['resume_id', 'jd_text'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ matchScore: 0.85, resume: input.resume_id }) }],
      }),
    });

    // People Search
    this.registerTool({
      name: 'atos_search_people',
      description: '自然语言搜索候选人（支持技能、经验、地域、薪资等多维度）',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '自然语言搜索查询' },
          filters: { type: 'object', description: '结构化过滤条件' },
          limit: { type: 'number', description: '返回数量', default: 20 },
        },
        required: ['query'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ query: input.query, results: [] }) }],
      }),
    });

    // Interview
    this.registerTool({
      name: 'atos_create_interview',
      description: '创建AI面试会话，生成面试问题和评估标准',
      inputSchema: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: '候选人ID' },
          job_id: { type: 'string', description: '岗位ID' },
          type: { type: 'string', enum: ['structured', 'behavioral', 'technical'], description: '面试类型' },
          duration_minutes: { type: 'number', description: '面试时长（分钟）', default: 45 },
        },
        required: ['candidate_id', 'job_id'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ sessionId: `int_${Date.now()}`, candidate: input.candidate_id }) }],
      }),
    });

    // Operator
    this.registerTool({
      name: 'atos_operator',
      description: '自然语言招聘指令（Ask ATOS），自动编排多Agent完成复杂招聘任务',
      inputSchema: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: '自然语言招聘指令' },
          context: { type: 'object', description: '上下文信息（岗位、部门等）' },
        },
        required: ['instruction'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ instruction: input.instruction, status: 'processing' }) }],
      }),
    });

    // Workflow
    this.registerTool({
      name: 'atos_execute_workflow',
      description: '执行预定义的招聘工作流（如完整面试流程、简历筛选流程）',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: { type: 'string', description: '工作流定义ID' },
          input: { type: 'object', description: '工作流输入参数' },
        },
        required: ['workflow_id', 'input'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ runId: `run_${Date.now()}`, workflow: input.workflow_id }) }],
      }),
    });

    // Memory
    this.registerTool({
      name: 'atos_query_memory',
      description: '查询候选人/招聘官的长期记忆（面试历史、偏好、评估记录）',
      inputSchema: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['candidate', 'recruiter', 'job'], description: '实体类型' },
          entity_id: { type: 'string', description: '实体ID' },
          query: { type: 'string', description: '记忆查询' },
        },
        required: ['entity_type', 'entity_id'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ entity: input.entity_id, memories: [] }) }],
      }),
    });

    // Evaluation
    this.registerTool({
      name: 'atos_run_eval',
      description: '运行Agent评估套件，检查AI输出质量',
      inputSchema: {
        type: 'object',
        properties: {
          suite_id: { type: 'string', description: '评估套件ID' },
          agent: { type: 'string', description: '目标Agent名称' },
        },
        required: ['suite_id', 'agent'],
      },
      handler: async (input, _ctx) => ({
        content: [{ type: 'text', text: JSON.stringify({ suite: input.suite_id, status: 'running' }) }],
      }),
    });
  }
}

// ============================================================
// Agent-to-Agent Protocol
// ============================================================

export interface A2AMessage {
  id: string;
  from: string;         // agent identifier
  to: string;           // target agent
  type: 'request' | 'response' | 'event' | 'error';
  action: string;
  payload: unknown;
  correlationId?: string;
  timestamp: number;
  ttl?: number;
}

export class AgentProtocol {
  private handlers: Map<string, (msg: A2AMessage) => Promise<A2AMessage>> = new Map();
  private messageLog: A2AMessage[] = [];

  /**
   * 注册Agent处理器
   */
  registerAgent(agentId: string, handler: (msg: A2AMessage) => Promise<A2AMessage>): void {
    this.handlers.set(agentId, handler);
  }

  /**
   * 发送消息
   */
  async send(message: Omit<A2AMessage, 'id' | 'timestamp'>): Promise<A2AMessage> {
    const msg: A2AMessage = {
      ...message,
      id: `a2a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.messageLog.push(msg);

    const handler = this.handlers.get(msg.to);
    if (!handler) {
      const errorMsg: A2AMessage = {
        id: `a2a_${Date.now()}_err`,
        from: 'system',
        to: msg.from,
        type: 'error',
        action: 'agent_not_found',
        payload: { target: msg.to },
        correlationId: msg.id,
        timestamp: Date.now(),
      };
      return errorMsg;
    }

    const response = await handler(msg);
    this.messageLog.push(response);
    return response;
  }

  /**
   * 广播事件
   */
  async broadcast(from: string, event: string, payload: unknown): Promise<void> {
    for (const [agentId, handler] of this.handlers) {
      if (agentId === from) continue;
      const msg: A2AMessage = {
        id: `a2a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        from,
        to: agentId,
        type: 'event',
        action: event,
        payload,
        timestamp: Date.now(),
      };
      this.messageLog.push(msg);
      try { await handler(msg); } catch { /* non-blocking */ }
    }
  }
}

// ============================================================
// OpenAPI Spec Generator
// ============================================================

export class OpenAPIGenerator {
  /**
   * 生成完整的OpenAPI 3.1规范
   */
  generate(): Record<string, unknown> {
    return {
      openapi: '3.1.0',
      info: {
        title: '蓉才通™ ATOS API',
        description: 'AI Talent Operating System — Enterprise Recruiting Intelligence Platform',
        version: '2.0.0',
        contact: { name: 'ATOS API Support', email: 'api@highermatch.com' },
        license: { name: 'Proprietary' },
      },
      servers: [
        { url: 'https://api.highermatch.com/v2', description: 'Production' },
        { url: 'https://sandbox.highermatch.com/v2', description: 'Sandbox' },
      ],
      security: [{ apiKey: [] }, { bearerAuth: [] }],
      paths: {
        '/resume/parse': { post: { summary: '解析简历', tags: ['Resume Intelligence'], operationId: 'parseResume' } },
        '/resume/match': { post: { summary: '简历匹配评分', tags: ['Resume Intelligence'], operationId: 'matchResume' } },
        '/resume/rank': { post: { summary: '批量排名', tags: ['Resume Intelligence'], operationId: 'rankResumes' } },
        '/interview/create': { post: { summary: '创建面试', tags: ['AI Interview'], operationId: 'createInterview' } },
        '/interview/{id}/start': { post: { summary: '开始面试', tags: ['AI Interview'], operationId: 'startInterview' } },
        '/interview/{id}/score': { get: { summary: '获取评分', tags: ['AI Interview'], operationId: 'getInterviewScore' } },
        '/people/search': { post: { summary: '搜索候选人', tags: ['PeopleGPT'], operationId: 'searchPeople' } },
        '/people/outreach': { post: { summary: '生成触达邮件', tags: ['PeopleGPT'], operationId: 'generateOutreach' } },
        '/operator/ask': { post: { summary: '自然语言指令', tags: ['Operator'], operationId: 'askOperator' } },
        '/workflow/execute': { post: { summary: '执行工作流', tags: ['Workflow'], operationId: 'executeWorkflow' } },
        '/workflow/{id}/status': { get: { summary: '查询状态', tags: ['Workflow'], operationId: 'getWorkflowStatus' } },
        '/memory/query': { post: { summary: '查询记忆', tags: ['Memory'], operationId: 'queryMemory' } },
        '/eval/run': { post: { summary: '运行评估', tags: ['Evaluation'], operationId: 'runEval' } },
        '/webhook': { post: { summary: '注册Webhook', tags: ['Webhook'], operationId: 'registerWebhook' } },
      },
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    };
  }
}

// ============================================================
// SDK Code Generator（TypeScript + Python）
// ============================================================

export class SDKGenerator {
  /**
   * 生成TypeScript SDK代码模板
   */
  generateTypeScriptSDK(): string {
    return `
// @highermatch/sdk - TypeScript SDK for ATOS API
// Auto-generated from OpenAPI 3.1 spec

export class ATOSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.highermatch.com/v2';
  }

  // Resume Intelligence
  resume = {
    parse: (params: { fileUrl: string; format?: string }) => this.post('/resume/parse', params),
    match: (params: { resumeId: string; jdText: string }) => this.post('/resume/match', params),
    rank: (params: { resumeIds: string[]; jdText: string }) => this.post('/resume/rank', params),
  };

  // AI Interview
  interview = {
    create: (params: { candidateId: string; jobId: string; type?: string }) => this.post('/interview/create', params),
    start: (id: string) => this.post(\`/interview/\${id}/start\`, {}),
    getScore: (id: string) => this.get(\`/interview/\${id}/score\`),
  };

  // PeopleGPT
  people = {
    search: (params: { query: string; filters?: Record<string, unknown>; limit?: number }) => this.post('/people/search', params),
    outreach: (params: { candidateId: string; tone?: string }) => this.post('/people/outreach', params),
  };

  // Operator
  operator = {
    ask: (params: { instruction: string; context?: Record<string, unknown> }) => this.post('/operator/ask', params),
  };

  // Workflow
  workflow = {
    execute: (params: { workflowId: string; input: Record<string, unknown> }) => this.post('/workflow/execute', params),
    getStatus: (id: string) => this.get(\`/workflow/\${id}/status\`),
  };

  // Memory
  memory = {
    query: (params: { entityType: string; entityId: string; query?: string }) => this.post('/memory/query', params),
  };

  private async post(path: string, body: unknown) {
    const res = await fetch(\`\${this.baseUrl}\${path}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  private async get(path: string) {
    const res = await fetch(\`\${this.baseUrl}\${path}\`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    return res.json();
  }
}
`;
  }

  /**
   * 生成Python SDK代码模板
   */
  generatePythonSDK(): string {
    return `
# highermatch-sdk - Python SDK for ATOS API
# Auto-generated from OpenAPI 3.1 spec

import httpx
from typing import Optional, Dict, Any, List

class ATOSClient:
    def __init__(self, api_key: str, base_url: str = "https://api.highermatch.com/v2"):
        self.api_key = api_key
        self.base_url = base_url
        self._client = httpx.Client(
            base_url=base_url,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=30.0,
        )

    # Resume Intelligence
    def parse_resume(self, file_url: str, format: str = "pdf") -> Dict[str, Any]:
        return self._post("/resume/parse", {"file_url": file_url, "format": format})

    def match_resume(self, resume_id: str, jd_text: str) -> Dict[str, Any]:
        return self._post("/resume/match", {"resume_id": resume_id, "jd_text": jd_text})

    def rank_resumes(self, resume_ids: List[str], jd_text: str) -> Dict[str, Any]:
        return self._post("/resume/rank", {"resume_ids": resume_ids, "jd_text": jd_text})

    # AI Interview
    def create_interview(self, candidate_id: str, job_id: str, type: str = "structured") -> Dict[str, Any]:
        return self._post("/interview/create", {"candidate_id": candidate_id, "job_id": job_id, "type": type})

    # PeopleGPT
    def search_people(self, query: str, filters: Optional[Dict] = None, limit: int = 20) -> Dict[str, Any]:
        return self._post("/people/search", {"query": query, "filters": filters or {}, "limit": limit})

    # Operator
    def ask(self, instruction: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        return self._post("/operator/ask", {"instruction": instruction, "context": context or {}})

    # Workflow
    def execute_workflow(self, workflow_id: str, input: Dict[str, Any]) -> Dict[str, Any]:
        return self._post("/workflow/execute", {"workflow_id": workflow_id, "input": input})

    def _post(self, path: str, body: Dict) -> Dict[str, Any]:
        response = self._client.post(path, json=body)
        response.raise_for_status()
        return response.json()

    def _get(self, path: str) -> Dict[str, Any]:
        response = self._client.get(path)
        response.raise_for_status()
        return response.json()

    def __del__(self):
        self._client.close()
`;
  }
}

// ============================================================
// 预置API路由定义
// ============================================================

export const API_ROUTES: GatewayRoute[] = [
  // Resume Intelligence
  { method: 'POST', path: '/v2/resume/parse', version: 'v2', handler: 'resume.parse', requiredScopes: ['resume:write'] },
  { method: 'POST', path: '/v2/resume/match', version: 'v2', handler: 'resume.match', requiredScopes: ['resume:read'] },
  { method: 'POST', path: '/v2/resume/rank', version: 'v2', handler: 'resume.rank', requiredScopes: ['resume:read'] },
  // Interview
  { method: 'POST', path: '/v2/interview/create', version: 'v2', handler: 'interview.create', requiredScopes: ['interview:write'] },
  { method: 'POST', path: '/v2/interview/:id/start', version: 'v2', handler: 'interview.start', requiredScopes: ['interview:execute'] },
  { method: 'GET', path: '/v2/interview/:id/score', version: 'v2', handler: 'interview.score', requiredScopes: ['interview:read'] },
  { method: 'GET', path: '/v2/interview/:id/report', version: 'v2', handler: 'interview.report', requiredScopes: ['interview:read'] },
  // PeopleGPT
  { method: 'POST', path: '/v2/people/search', version: 'v2', handler: 'people.search', requiredScopes: ['people:search'] },
  { method: 'POST', path: '/v2/people/outreach', version: 'v2', handler: 'people.outreach', requiredScopes: ['people:read'] },
  // Operator
  { method: 'POST', path: '/v2/operator/ask', version: 'v2', handler: 'operator.ask', requiredScopes: ['operator:execute'] },
  { method: 'GET', path: '/v2/operator/:id/status', version: 'v2', handler: 'operator.status', requiredScopes: ['operator:read'] },
  // Workflow
  { method: 'POST', path: '/v2/workflow/execute', version: 'v2', handler: 'workflow.execute', requiredScopes: ['workflow:execute'] },
  { method: 'GET', path: '/v2/workflow/:id/status', version: 'v2', handler: 'workflow.status', requiredScopes: ['workflow:read'] },
  { method: 'POST', path: '/v2/workflow/:id/cancel', version: 'v2', handler: 'workflow.cancel', requiredScopes: ['workflow:write'] },
  // Memory
  { method: 'POST', path: '/v2/memory/query', version: 'v2', handler: 'memory.query', requiredScopes: ['memory:read'] },
  { method: 'POST', path: '/v2/memory/store', version: 'v2', handler: 'memory.store', requiredScopes: ['memory:write'] },
  // Eval
  { method: 'POST', path: '/v2/eval/run', version: 'v2', handler: 'eval.run', requiredScopes: ['eval:execute'] },
  { method: 'GET', path: '/v2/eval/:id/results', version: 'v2', handler: 'eval.results', requiredScopes: ['eval:read'] },
  // Webhook
  { method: 'POST', path: '/v2/webhook', version: 'v2', handler: 'webhook.register', requiredScopes: ['webhook:manage'] },
  { method: 'DELETE', path: '/v2/webhook/:id', version: 'v2', handler: 'webhook.delete', requiredScopes: ['webhook:manage'] },
];

// ============================================================
// 单例导出
// ============================================================

export const apiKeyManager = new APIKeyManager();
export const apiGateway = new APIGateway();
export const webhookManager = new WebhookManager();
export const mcpServer = new MCPServer();
export const agentProtocol = new AgentProtocol();
export const openAPIGenerator = new OpenAPIGenerator();
export const sdkGenerator = new SDKGenerator();

// 注册默认路由
API_ROUTES.forEach(route => apiGateway.registerRoute(route));
