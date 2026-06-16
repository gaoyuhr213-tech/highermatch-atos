/**
 * Phase 14-E: SDK Documentation & Developer Experience
 * 
 * TypeDoc + Sphinx + Postman Collection + Developer Portal
 * 
 * 对标：Stripe Docs / Twilio / OpenAI API Reference
 * 
 * 架构：
 * SDK Documentation System
 *   ├── OpenAPI Spec (auto-generated)
 *   ├── TypeScript SDK (type-safe client)
 *   ├── Python SDK (requests-based)
 *   ├── Postman Collection (import-ready)
 *   ├── Developer Portal (interactive docs)
 *   └── Code Examples (per-endpoint)
 */

// ============================================================
// Types
// ============================================================

export interface SDKConfig {
  name: string;
  version: string;
  baseUrl: string;
  description: string;
  contact: { name: string; email: string; url: string };
  license: { name: string; url: string };
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description: string;
  tags: string[];
  auth: 'api_key' | 'bearer' | 'none';
  parameters?: APIParameter[];
  requestBody?: APIRequestBody;
  responses: Record<string, APIResponse>;
  examples: APIExample[];
  rateLimit: { requests: number; window: string };
}

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: unknown;
}

export interface APIRequestBody {
  contentType: string;
  schema: Record<string, unknown>;
  required: boolean;
  example: unknown;
}

export interface APIResponse {
  description: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface APIExample {
  language: 'typescript' | 'python' | 'curl' | 'java';
  code: string;
  description: string;
}

// ============================================================
// OpenAPI Spec Generator
// ============================================================

export class OpenAPISpecGenerator {
  private config: SDKConfig = {
    name: '蓉才通 ATOS API',
    version: '2.0.0',
    baseUrl: 'https://api.highermatch.cn',
    description: 'AI Talent Operating System — Enterprise Recruiting Intelligence Platform',
    contact: { name: 'ATOS Developer Support', email: 'dev@highermatch.cn', url: 'https://docs.highermatch.cn' },
    license: { name: 'Commercial', url: 'https://highermatch.cn/license' },
  };

  generate(): object {
    return {
      openapi: '3.1.0',
      info: {
        title: this.config.name,
        version: this.config.version,
        description: this.config.description,
        contact: this.config.contact,
        license: this.config.license,
        'x-logo': { url: 'https://highermatch.cn/logo.svg', altText: 'ATOS Logo' },
      },
      servers: [
        { url: 'https://api.highermatch.cn/v2', description: 'Production' },
        { url: 'https://staging-api.highermatch.cn/v2', description: 'Staging' },
        { url: 'http://localhost:3000/api/v2', description: 'Local Development' },
      ],
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API Key for server-to-server authentication' },
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token for user authentication' },
        },
        schemas: this.generateSchemas(),
      },
      tags: this.generateTags(),
      paths: this.generatePaths(),
    };
  }

  private generateTags(): Array<{ name: string; description: string }> {
    return [
      { name: 'Resume', description: 'Resume parsing, matching, and intelligence' },
      { name: 'Interview', description: 'AI-powered interview sessions and analysis' },
      { name: 'People', description: 'Talent search and candidate discovery (PeopleGPT)' },
      { name: 'Copilot', description: 'Candidate career copilot services' },
      { name: 'Workflow', description: 'Multi-agent workflow orchestration' },
      { name: 'Operator', description: 'Natural language recruiting command center' },
      { name: 'Memory', description: 'Long-term memory and context management' },
      { name: 'Eval', description: 'Agent evaluation and quality monitoring' },
      { name: 'Webhook', description: 'Event subscriptions and notifications' },
      { name: 'Admin', description: 'Tenant and organization management' },
    ];
  }

  private generateSchemas(): Record<string, unknown> {
    return {
      // Resume
      ResumeParseRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Resume text content or base64 encoded file' },
          format: { type: 'string', enum: ['text', 'pdf', 'docx', 'html'], default: 'text' },
          language: { type: 'string', default: 'auto' },
        },
      },
      ResumeParseResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          skills: { type: 'array', items: { $ref: '#/components/schemas/Skill' } },
          experience: { type: 'array', items: { $ref: '#/components/schemas/Experience' } },
          education: { type: 'array', items: { $ref: '#/components/schemas/Education' } },
          summary: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      Skill: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
          years: { type: 'number' },
          category: { type: 'string' },
        },
      },
      Experience: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date', nullable: true },
          description: { type: 'string' },
          achievements: { type: 'array', items: { type: 'string' } },
        },
      },
      Education: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string' },
          field: { type: 'string' },
          graduationDate: { type: 'string', format: 'date' },
        },
      },
      // Match
      MatchRequest: {
        type: 'object',
        required: ['resumeId', 'jobDescription'],
        properties: {
          resumeId: { type: 'string' },
          jobDescription: { $ref: '#/components/schemas/JobDescription' },
          weights: { type: 'object', description: 'Custom scoring weights' },
        },
      },
      MatchResponse: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 100 },
          breakdown: { type: 'object' },
          matchedSkills: { type: 'array', items: { type: 'string' } },
          missingSkills: { type: 'array', items: { type: 'string' } },
          riskSignals: { type: 'array', items: { $ref: '#/components/schemas/RiskSignal' } },
          explanation: { type: 'string' },
        },
      },
      JobDescription: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          location: { type: 'string' },
          experience: { type: 'string' },
        },
      },
      RiskSignal: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          description: { type: 'string' },
        },
      },
      // People Search
      PeopleSearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          filters: { $ref: '#/components/schemas/SearchFilters' },
          limit: { type: 'integer', default: 20, maximum: 100 },
        },
      },
      SearchFilters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          minExperience: { type: 'integer' },
          maxExperience: { type: 'integer' },
          skills: { type: 'array', items: { type: 'string' } },
          companies: { type: 'array', items: { type: 'string' } },
        },
      },
      // Operator
      OperatorRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', description: 'Natural language command' },
          conversationId: { type: 'string', description: 'Continue existing conversation' },
          context: { type: 'object', description: 'Additional context' },
        },
      },
      OperatorResponse: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          actions: { type: 'array', items: { type: 'object' } },
          data: { type: 'object' },
          conversationId: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      // Common
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          requestId: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          hasMore: { type: 'boolean' },
        },
      },
    };
  }

  private generatePaths(): Record<string, unknown> {
    return {
      '/resume/parse': {
        post: {
          tags: ['Resume'],
          summary: 'Parse a resume',
          description: 'Extract structured data from resume text or file. Supports PDF, DOCX, HTML, and plain text.',
          operationId: 'parseResume',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumeParseRequest' } } } },
          responses: {
            '200': { description: 'Successfully parsed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumeParseResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/resume/match': {
        post: {
          tags: ['Resume'],
          summary: 'Match resume against job description',
          operationId: 'matchResume',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchRequest' } } } },
          responses: {
            '200': { description: 'Match result', content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchResponse' } } } },
          },
        },
      },
      '/people/search': {
        post: {
          tags: ['People'],
          summary: 'Search for candidates using natural language',
          operationId: 'searchPeople',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PeopleSearchRequest' } } } },
          responses: { '200': { description: 'Search results' } },
        },
      },
      '/operator/ask': {
        post: {
          tags: ['Operator'],
          summary: 'Ask the recruiting operator',
          description: 'Send a natural language command to the AI recruiting operator. It will automatically orchestrate multiple agents to fulfill your request.',
          operationId: 'askOperator',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OperatorRequest' } } } },
          responses: { '200': { description: 'Operator response', content: { 'application/json': { schema: { $ref: '#/components/schemas/OperatorResponse' } } } } },
        },
      },
    };
  }
}

// ============================================================
// Postman Collection Generator
// ============================================================

export class PostmanCollectionGenerator {
  generate(): object {
    return {
      info: {
        name: '蓉才通 ATOS API',
        description: 'Complete API collection for ATOS - AI Talent Operating System',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        version: '2.0.0',
      },
      auth: {
        type: 'apikey',
        apikey: [
          { key: 'key', value: 'X-API-Key', type: 'string' },
          { key: 'value', value: '{{api_key}}', type: 'string' },
          { key: 'in', value: 'header', type: 'string' },
        ],
      },
      variable: [
        { key: 'base_url', value: 'http://localhost:3000/api/v2', type: 'string' },
        { key: 'api_key', value: 'your-api-key-here', type: 'string' },
        { key: 'tenant_id', value: 'your-tenant-id', type: 'string' },
      ],
      item: [
        this.generateResumeFolder(),
        this.generateInterviewFolder(),
        this.generatePeopleFolder(),
        this.generateOperatorFolder(),
        this.generateWorkflowFolder(),
        this.generateAdminFolder(),
      ],
    };
  }

  private generateResumeFolder(): object {
    return {
      name: 'Resume Intelligence',
      item: [
        {
          name: 'Parse Resume (Text)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ content: 'Senior Software Engineer with 10 years experience...', format: 'text' }, null, 2) },
            url: { raw: '{{base_url}}/resume/parse', host: ['{{base_url}}'], path: ['resume', 'parse'] },
          },
        },
        {
          name: 'Match Resume to JD',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ resumeId: 'resume-uuid', jobDescription: { title: 'Senior Backend Engineer', requirements: ['Go', 'Kubernetes', '5+ years'] } }, null, 2) },
            url: { raw: '{{base_url}}/resume/match', host: ['{{base_url}}'], path: ['resume', 'match'] },
          },
        },
        {
          name: 'Batch Rank Candidates',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ resumeIds: ['id1', 'id2', 'id3'], jobDescription: { title: 'Engineer' }, limit: 10 }, null, 2) },
            url: { raw: '{{base_url}}/resume/rank', host: ['{{base_url}}'], path: ['resume', 'rank'] },
          },
        },
      ],
    };
  }

  private generateInterviewFolder(): object {
    return {
      name: 'AI Interview',
      item: [
        {
          name: 'Create Interview Session',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ candidateId: 'candidate-001', jobId: 'job-001', interviewType: 'behavioral', duration: 30 }, null, 2) },
            url: { raw: '{{base_url}}/interview/sessions', host: ['{{base_url}}'], path: ['interview', 'sessions'] },
          },
        },
        {
          name: 'Get Interview Report',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/interview/sessions/:sessionId/report', host: ['{{base_url}}'], path: ['interview', 'sessions', ':sessionId', 'report'], variable: [{ key: 'sessionId', value: 'session-uuid' }] },
          },
        },
      ],
    };
  }

  private generatePeopleFolder(): object {
    return {
      name: 'PeopleGPT',
      item: [
        {
          name: 'Natural Language Search',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ query: '找到成都地区有5年以上Go和Kubernetes经验的高级后端工程师', filters: { location: 'Chengdu', minExperience: 5 }, limit: 20 }, null, 2) },
            url: { raw: '{{base_url}}/people/search', host: ['{{base_url}}'], path: ['people', 'search'] },
          },
        },
        {
          name: 'Generate Outreach Email',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ candidateId: 'candidate-001', jobId: 'job-001', tone: 'professional', language: 'zh-CN' }, null, 2) },
            url: { raw: '{{base_url}}/people/outreach', host: ['{{base_url}}'], path: ['people', 'outreach'] },
          },
        },
      ],
    };
  }

  private generateOperatorFolder(): object {
    return {
      name: 'Recruiting Operator',
      item: [
        {
          name: 'Ask Operator (Find Best Candidate)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ message: '帮我找到最适合高级后端工程师岗位的候选人，要求有分布式系统经验', context: { jobId: 'job-001' } }, null, 2) },
            url: { raw: '{{base_url}}/operator/ask', host: ['{{base_url}}'], path: ['operator', 'ask'] },
          },
        },
        {
          name: 'Ask Operator (Risk Analysis)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ message: '这批候选人中谁的风险最高？为什么？', conversationId: 'conv-uuid' }, null, 2) },
            url: { raw: '{{base_url}}/operator/ask', host: ['{{base_url}}'], path: ['operator', 'ask'] },
          },
        },
        {
          name: 'Ask Operator (Pipeline Status)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ message: '当前招聘管道状态如何？有哪些岗位进展缓慢？' }, null, 2) },
            url: { raw: '{{base_url}}/operator/ask', host: ['{{base_url}}'], path: ['operator', 'ask'] },
          },
        },
      ],
    };
  }

  private generateWorkflowFolder(): object {
    return {
      name: 'Workflow',
      item: [
        {
          name: 'Execute Workflow',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ workflowId: 'interview-full', input: { candidateId: 'c-001', jobId: 'j-001' } }, null, 2) },
            url: { raw: '{{base_url}}/workflow/execute', host: ['{{base_url}}'], path: ['workflow', 'execute'] },
          },
        },
        {
          name: 'Get Workflow Status',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/workflow/runs/:runId', host: ['{{base_url}}'], path: ['workflow', 'runs', ':runId'], variable: [{ key: 'runId', value: 'run-uuid' }] },
          },
        },
        {
          name: 'List Workflow Definitions',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/workflow/definitions', host: ['{{base_url}}'], path: ['workflow', 'definitions'] },
          },
        },
      ],
    };
  }

  private generateAdminFolder(): object {
    return {
      name: 'Admin',
      item: [
        {
          name: 'Get Tenant Info',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/admin/tenant', host: ['{{base_url}}'], path: ['admin', 'tenant'] },
          },
        },
        {
          name: 'List API Keys',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/admin/api-keys', host: ['{{base_url}}'], path: ['admin', 'api-keys'] },
          },
        },
        {
          name: 'Get Usage Stats',
          request: {
            method: 'GET',
            url: { raw: '{{base_url}}/admin/usage?period=30d', host: ['{{base_url}}'], path: ['admin', 'usage'], query: [{ key: 'period', value: '30d' }] },
          },
        },
      ],
    };
  }
}

// ============================================================
// TypeScript SDK Generator
// ============================================================

export class TypeScriptSDKGenerator {
  generateSDKCode(): string {
    return `/**
 * 蓉才通 ATOS TypeScript SDK
 * @version 2.0.0
 * @description Type-safe client for ATOS AI Recruiting OS
 * 
 * Installation:
 *   npm install @highermatch/atos-sdk
 *   pnpm add @highermatch/atos-sdk
 * 
 * Usage:
 *   import { ATOSClient } from '@highermatch/atos-sdk';
 *   const atos = new ATOSClient({ apiKey: 'your-key' });
 *   const result = await atos.resume.parse({ content: '...' });
 */

export interface ATOSConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  onError?: (error: ATOSError) => void;
}

export class ATOSClient {
  readonly resume: ResumeAPI;
  readonly interview: InterviewAPI;
  readonly people: PeopleAPI;
  readonly operator: OperatorAPI;
  readonly workflow: WorkflowAPI;
  readonly memory: MemoryAPI;
  readonly admin: AdminAPI;

  constructor(config: ATOSConfig) {
    const http = new HTTPClient(config);
    this.resume = new ResumeAPI(http);
    this.interview = new InterviewAPI(http);
    this.people = new PeopleAPI(http);
    this.operator = new OperatorAPI(http);
    this.workflow = new WorkflowAPI(http);
    this.memory = new MemoryAPI(http);
    this.admin = new AdminAPI(http);
  }
}

// ─── Resume API ──────────────────────────────────────────
class ResumeAPI {
  constructor(private http: HTTPClient) {}

  /** Parse resume from text or file */
  async parse(input: { content: string; format?: 'text' | 'pdf' | 'docx' }): Promise<ParsedResume> {
    return this.http.post('/resume/parse', input);
  }

  /** Match resume against job description */
  async match(input: { resumeId: string; jobDescription: JobDescription }): Promise<MatchResult> {
    return this.http.post('/resume/match', input);
  }

  /** Batch rank candidates for a position */
  async rank(input: { resumeIds: string[]; jobDescription: JobDescription; limit?: number }): Promise<RankedCandidate[]> {
    return this.http.post('/resume/rank', input);
  }
}

// ─── Interview API ───────────────────────────────────────
class InterviewAPI {
  constructor(private http: HTTPClient) {}

  /** Create a new interview session */
  async createSession(input: { candidateId: string; jobId: string; type?: string }): Promise<InterviewSession> {
    return this.http.post('/interview/sessions', input);
  }

  /** Get interview report */
  async getReport(sessionId: string): Promise<InterviewReport> {
    return this.http.get('/interview/sessions/' + sessionId + '/report');
  }
}

// ─── People API ──────────────────────────────────────────
class PeopleAPI {
  constructor(private http: HTTPClient) {}

  /** Natural language talent search */
  async search(input: { query: string; filters?: SearchFilters; limit?: number }): Promise<SearchResult> {
    return this.http.post('/people/search', input);
  }

  /** Generate outreach email */
  async outreach(input: { candidateId: string; jobId: string; tone?: string }): Promise<OutreachEmail> {
    return this.http.post('/people/outreach', input);
  }
}

// ─── Operator API ────────────────────────────────────────
class OperatorAPI {
  constructor(private http: HTTPClient) {}

  /** Send natural language command to recruiting operator */
  async ask(input: { message: string; conversationId?: string; context?: Record<string, unknown> }): Promise<OperatorResponse> {
    return this.http.post('/operator/ask', input);
  }
}

// ─── Workflow API ────────────────────────────────────────
class WorkflowAPI {
  constructor(private http: HTTPClient) {}

  /** Execute a workflow */
  async execute(input: { workflowId: string; input: Record<string, unknown> }): Promise<WorkflowRun> {
    return this.http.post('/workflow/execute', input);
  }

  /** Get workflow run status */
  async getStatus(runId: string): Promise<WorkflowRun> {
    return this.http.get('/workflow/runs/' + runId);
  }

  /** List available workflow definitions */
  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return this.http.get('/workflow/definitions');
  }
}

// ─── Memory API ──────────────────────────────────────────
class MemoryAPI {
  constructor(private http: HTTPClient) {}

  /** Store a memory entry */
  async store(input: { type: string; content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }> {
    return this.http.post('/memory/store', input);
  }

  /** Search memories */
  async search(input: { query: string; type?: string; limit?: number }): Promise<MemoryEntry[]> {
    return this.http.post('/memory/search', input);
  }
}

// ─── Admin API ───────────────────────────────────────────
class AdminAPI {
  constructor(private http: HTTPClient) {}

  /** Get tenant information */
  async getTenant(): Promise<TenantInfo> {
    return this.http.get('/admin/tenant');
  }

  /** Get usage statistics */
  async getUsage(period?: string): Promise<UsageStats> {
    return this.http.get('/admin/usage?period=' + (period || '30d'));
  }
}

// ─── HTTP Client ─────────────────────────────────────────
class HTTPClient {
  constructor(private config: ATOSConfig) {}
  async get<T>(path: string): Promise<T> { return {} as T; }
  async post<T>(path: string, body: unknown): Promise<T> { return {} as T; }
}

// ─── Types ───────────────────────────────────────────────
interface ParsedResume { id: string; name: string; skills: Array<{ name: string; level: string }>; experience: unknown[]; }
interface MatchResult { score: number; matchedSkills: string[]; missingSkills: string[]; explanation: string; }
interface RankedCandidate { resumeId: string; rank: number; score: number; reason: string; }
interface JobDescription { title: string; requirements: string[]; location?: string; }
interface InterviewSession { sessionId: string; status: string; }
interface InterviewReport { sessionId: string; overallScore: number; competencies: unknown[]; summary: string; }
interface SearchResult { candidates: unknown[]; total: number; }
interface SearchFilters { location?: string; minExperience?: number; skills?: string[]; }
interface OutreachEmail { subject: string; body: string; followUps: string[]; }
interface OperatorResponse { answer: string; actions: unknown[]; data: unknown; conversationId: string; }
interface WorkflowRun { runId: string; status: string; progress: number; result?: unknown; }
interface WorkflowDefinition { id: string; name: string; description: string; }
interface MemoryEntry { id: string; content: string; type: string; relevance: number; }
interface TenantInfo { id: string; name: string; plan: string; usage: unknown; }
interface UsageStats { period: string; apiCalls: number; tokens: number; cost: number; }
interface ATOSError { code: string; message: string; requestId: string; }
`;
  }
}

// ============================================================
// Python SDK Generator
// ============================================================

export class PythonSDKGenerator {
  generateSDKCode(): string {
    return `"""
蓉才通 ATOS Python SDK
Version: 2.0.0
Description: Python client for ATOS AI Recruiting OS

Installation:
    pip install highermatch-atos

Usage:
    from atos import ATOSClient
    client = ATOSClient(api_key="your-key")
    result = client.resume.parse(content="...")
"""

from typing import Optional, Dict, List, Any
from dataclasses import dataclass
import requests


@dataclass
class ATOSConfig:
    api_key: str
    base_url: str = "https://api.highermatch.cn/v2"
    timeout: int = 30
    max_retries: int = 3


class ATOSClient:
    """Main client for ATOS API."""

    def __init__(self, api_key: str, base_url: str = None, **kwargs):
        self.config = ATOSConfig(
            api_key=api_key,
            base_url=base_url or "https://api.highermatch.cn/v2",
            **kwargs
        )
        self._session = requests.Session()
        self._session.headers.update({
            "X-API-Key": self.config.api_key,
            "Content-Type": "application/json",
        })

        # API namespaces
        self.resume = ResumeAPI(self)
        self.interview = InterviewAPI(self)
        self.people = PeopleAPI(self)
        self.operator = OperatorAPI(self)
        self.workflow = WorkflowAPI(self)
        self.memory = MemoryAPI(self)
        self.admin = AdminAPI(self)

    def _request(self, method: str, path: str, **kwargs) -> Dict:
        url = f"{self.config.base_url}{path}"
        response = self._session.request(method, url, timeout=self.config.timeout, **kwargs)
        response.raise_for_status()
        return response.json()


class ResumeAPI:
    """Resume parsing, matching, and intelligence."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def parse(self, content: str, format: str = "text") -> Dict:
        """Parse resume from text or file content."""
        return self._client._request("POST", "/resume/parse", json={"content": content, "format": format})

    def match(self, resume_id: str, job_description: Dict) -> Dict:
        """Match resume against job description."""
        return self._client._request("POST", "/resume/match", json={"resumeId": resume_id, "jobDescription": job_description})

    def rank(self, resume_ids: List[str], job_description: Dict, limit: int = 10) -> List[Dict]:
        """Batch rank candidates for a position."""
        return self._client._request("POST", "/resume/rank", json={"resumeIds": resume_ids, "jobDescription": job_description, "limit": limit})


class InterviewAPI:
    """AI-powered interview sessions."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def create_session(self, candidate_id: str, job_id: str, interview_type: str = "behavioral") -> Dict:
        """Create a new interview session."""
        return self._client._request("POST", "/interview/sessions", json={"candidateId": candidate_id, "jobId": job_id, "interviewType": interview_type})

    def get_report(self, session_id: str) -> Dict:
        """Get interview report."""
        return self._client._request("GET", f"/interview/sessions/{session_id}/report")


class PeopleAPI:
    """Talent search and candidate discovery."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def search(self, query: str, filters: Optional[Dict] = None, limit: int = 20) -> Dict:
        """Natural language talent search."""
        return self._client._request("POST", "/people/search", json={"query": query, "filters": filters or {}, "limit": limit})

    def outreach(self, candidate_id: str, job_id: str, tone: str = "professional") -> Dict:
        """Generate outreach email."""
        return self._client._request("POST", "/people/outreach", json={"candidateId": candidate_id, "jobId": job_id, "tone": tone})


class OperatorAPI:
    """Natural language recruiting command center."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def ask(self, message: str, conversation_id: Optional[str] = None, context: Optional[Dict] = None) -> Dict:
        """Send natural language command to recruiting operator."""
        payload = {"message": message}
        if conversation_id:
            payload["conversationId"] = conversation_id
        if context:
            payload["context"] = context
        return self._client._request("POST", "/operator/ask", json=payload)


class WorkflowAPI:
    """Multi-agent workflow orchestration."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def execute(self, workflow_id: str, input_data: Dict) -> Dict:
        """Execute a workflow."""
        return self._client._request("POST", "/workflow/execute", json={"workflowId": workflow_id, "input": input_data})

    def get_status(self, run_id: str) -> Dict:
        """Get workflow run status."""
        return self._client._request("GET", f"/workflow/runs/{run_id}")

    def list_definitions(self) -> List[Dict]:
        """List available workflow definitions."""
        return self._client._request("GET", "/workflow/definitions")


class MemoryAPI:
    """Long-term memory management."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def store(self, type: str, content: str, metadata: Optional[Dict] = None) -> Dict:
        """Store a memory entry."""
        return self._client._request("POST", "/memory/store", json={"type": type, "content": content, "metadata": metadata or {}})

    def search(self, query: str, type: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Search memories."""
        return self._client._request("POST", "/memory/search", json={"query": query, "type": type, "limit": limit})


class AdminAPI:
    """Tenant and organization management."""

    def __init__(self, client: ATOSClient):
        self._client = client

    def get_tenant(self) -> Dict:
        """Get tenant information."""
        return self._client._request("GET", "/admin/tenant")

    def get_usage(self, period: str = "30d") -> Dict:
        """Get usage statistics."""
        return self._client._request("GET", f"/admin/usage?period={period}")
`;
  }
}

// ============================================================
// Documentation Site Generator
// ============================================================

export class DocsSiteGenerator {
  generateStructure(): Record<string, string> {
    return {
      'docs/index.md': this.generateIndex(),
      'docs/quickstart.md': this.generateQuickstart(),
      'docs/authentication.md': this.generateAuthDocs(),
      'docs/rate-limits.md': this.generateRateLimitDocs(),
      'docs/errors.md': this.generateErrorDocs(),
      'docs/webhooks.md': this.generateWebhookDocs(),
      'docs/changelog.md': this.generateChangelog(),
    };
  }

  private generateIndex(): string {
    return `# 蓉才通 ATOS API Documentation

Welcome to the ATOS API documentation. ATOS (AI Talent Operating System) provides enterprise-grade AI recruiting intelligence through a simple REST API.

## Quick Links

| Resource | Description |
|----------|-------------|
| [Quickstart](./quickstart.md) | Get up and running in 5 minutes |
| [Authentication](./authentication.md) | API key and JWT authentication |
| [Rate Limits](./rate-limits.md) | Request limits and best practices |
| [Errors](./errors.md) | Error codes and handling |
| [Webhooks](./webhooks.md) | Real-time event notifications |
| [Changelog](./changelog.md) | API version history |

## API Modules

| Module | Description | Base Path |
|--------|-------------|-----------|
| Resume Intelligence | Parse, match, and rank resumes | \`/v2/resume/*\` |
| AI Interview | Conduct and analyze interviews | \`/v2/interview/*\` |
| PeopleGPT | Natural language talent search | \`/v2/people/*\` |
| Recruiting Operator | NL command center | \`/v2/operator/*\` |
| Workflow | Multi-agent orchestration | \`/v2/workflow/*\` |
| Memory | Long-term context | \`/v2/memory/*\` |
| Admin | Tenant management | \`/v2/admin/*\` |

## SDKs

| Language | Package | Install |
|----------|---------|---------|
| TypeScript | \`@highermatch/atos-sdk\` | \`npm install @highermatch/atos-sdk\` |
| Python | \`highermatch-atos\` | \`pip install highermatch-atos\` |
| Java | \`cn.highermatch:atos-sdk\` | Maven/Gradle |

## Support

- Developer Portal: https://docs.highermatch.cn
- Email: dev@highermatch.cn
- Status Page: https://status.highermatch.cn
`;
  }

  private generateQuickstart(): string {
    return `# Quickstart

Get started with ATOS API in 5 minutes.

## 1. Get your API Key

Sign up at [dashboard.highermatch.cn](https://dashboard.highermatch.cn) and create an API key.

## 2. Install SDK

\`\`\`bash
# TypeScript
npm install @highermatch/atos-sdk

# Python
pip install highermatch-atos
\`\`\`

## 3. Parse your first resume

\`\`\`typescript
import { ATOSClient } from '@highermatch/atos-sdk';

const atos = new ATOSClient({ apiKey: 'your-api-key' });

const resume = await atos.resume.parse({
  content: 'Senior Software Engineer with 10 years experience in distributed systems...',
  format: 'text',
});

console.log(resume.skills); // [{ name: 'Distributed Systems', level: 'expert' }, ...]
\`\`\`

## 4. Search for candidates

\`\`\`typescript
const results = await atos.people.search({
  query: '找到有5年以上Go经验的后端工程师',
  filters: { location: 'Chengdu' },
  limit: 10,
});
\`\`\`

## 5. Ask the Operator

\`\`\`typescript
const response = await atos.operator.ask({
  message: '帮我找到最适合这个岗位的候选人，并解释为什么推荐他们',
});

console.log(response.answer);
\`\`\`
`;
  }

  private generateAuthDocs(): string {
    return `# Authentication

ATOS API supports two authentication methods.

## API Key (Server-to-Server)

Include your API key in the \`X-API-Key\` header:

\`\`\`bash
curl -H "X-API-Key: your-api-key" https://api.highermatch.cn/v2/resume/parse
\`\`\`

## JWT Bearer Token (User Context)

For user-specific operations, use a JWT token:

\`\`\`bash
curl -H "Authorization: Bearer eyJhbG..." https://api.highermatch.cn/v2/admin/tenant
\`\`\`

## API Key Scopes

| Scope | Access |
|-------|--------|
| \`resume:read\` | Parse and view resumes |
| \`resume:write\` | Upload and modify resumes |
| \`interview:*\` | Full interview access |
| \`people:search\` | Talent search |
| \`operator:*\` | Operator commands |
| \`admin:*\` | Tenant management |
`;
  }

  private generateRateLimitDocs(): string {
    return `# Rate Limits

Rate limits protect the API from abuse and ensure fair usage.

## Default Limits

| Plan | Requests/min | Requests/day | Concurrent |
|------|-------------|-------------|------------|
| Free | 60 | 1,000 | 5 |
| Pro | 600 | 50,000 | 50 |
| Enterprise | 6,000 | Unlimited | 500 |

## Headers

Every response includes rate limit headers:

\`\`\`
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 594
X-RateLimit-Reset: 1625097600
\`\`\`

## 429 Too Many Requests

When rate limited, wait for the \`Retry-After\` header value before retrying.
`;
  }

  private generateErrorDocs(): string {
    return `# Error Handling

All errors follow a consistent format.

## Error Response

\`\`\`json
{
  "error": {
    "code": "invalid_request",
    "message": "Resume content is required",
    "details": { "field": "content" },
    "requestId": "req_abc123"
  }
}
\`\`\`

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| \`invalid_request\` | 400 | Malformed request |
| \`unauthorized\` | 401 | Invalid or missing API key |
| \`forbidden\` | 403 | Insufficient permissions |
| \`not_found\` | 404 | Resource not found |
| \`rate_limited\` | 429 | Too many requests |
| \`internal_error\` | 500 | Server error |
| \`service_unavailable\` | 503 | Temporarily unavailable |
`;
  }

  private generateWebhookDocs(): string {
    return `# Webhooks

Receive real-time notifications when events occur.

## Supported Events

| Event | Description |
|-------|-------------|
| \`resume.parsed\` | Resume parsing completed |
| \`interview.completed\` | Interview session ended |
| \`interview.report_ready\` | Interview report generated |
| \`workflow.completed\` | Workflow execution finished |
| \`candidate.matched\` | New candidate match found |

## Webhook Payload

\`\`\`json
{
  "id": "evt_abc123",
  "type": "interview.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... },
  "signature": "sha256=..."
}
\`\`\`

## Signature Verification

Verify webhook authenticity using HMAC-SHA256:

\`\`\`typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from('sha256=' + expected));
}
\`\`\`
`;
  }

  private generateChangelog(): string {
    return `# Changelog

## v2.0.0 (2024-06)

- Added Recruiting Operator (natural language command center)
- Added Memory OS (long-term context for all agents)
- Added Workflow orchestration API
- Added Multimodal interview signals
- Added A/B testing and experiment platform
- Breaking: All endpoints moved to /v2/ prefix

## v1.0.0 (2024-03)

- Initial release
- Resume parsing and matching
- AI Interview sessions
- PeopleGPT search
- Candidate Copilot
`;
  }
}

// ============================================================
// API Routes
// ============================================================

export const SDK_ROUTES = {
  'GET /api/v2/docs/openapi.json': 'getOpenAPISpec',
  'GET /api/v2/docs/postman.json': 'getPostmanCollection',
  'GET /api/v2/docs/sdk/typescript': 'getTypeScriptSDK',
  'GET /api/v2/docs/sdk/python': 'getPythonSDK',
  'GET /api/v2/docs/changelog': 'getChangelog',
} as const;
