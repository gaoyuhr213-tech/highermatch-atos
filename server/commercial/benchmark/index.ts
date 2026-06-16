/**
 * Phase 14-D: Performance Benchmark & Load Testing
 * 
 * 1000并发 + 10万简历批量处理
 * 
 * 对标：k6 / Artillery / Locust / Gatling
 * 
 * 架构：
 * BenchmarkSuite
 *   ├── LoadTestRunner (k6 config generator)
 *   ├── ScenarioBuilder (场景定义)
 *   ├── ProfileAnalyzer (性能分析)
 *   └── ReportGenerator (报告生成)
 */

// ============================================================
// Types
// ============================================================

export interface BenchmarkConfig {
  name: string;
  description: string;
  scenarios: BenchmarkScenario[];
  thresholds: PerformanceThreshold[];
  environment: {
    baseUrl: string;
    apiKey: string;
    concurrency: number;
    duration: string; // '5m', '30m', '1h'
    rampUp: string;  // '30s', '2m'
  };
}

export interface BenchmarkScenario {
  name: string;
  weight: number; // traffic percentage
  executor: 'constant-vus' | 'ramping-vus' | 'constant-arrival-rate' | 'ramping-arrival-rate';
  config: {
    vus?: number;
    duration?: string;
    rate?: number;
    timeUnit?: string;
    stages?: Array<{ duration: string; target: number }>;
  };
  requests: ScenarioRequest[];
}

export interface ScenarioRequest {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  checks: RequestCheck[];
  thinkTime?: string; // pause between requests
}

export interface RequestCheck {
  type: 'status' | 'response_time' | 'body_contains' | 'json_path';
  expected: unknown;
  name: string;
}

export interface PerformanceThreshold {
  metric: string;
  condition: string; // 'p(95)<500', 'rate>0.99'
  abortOnFail: boolean;
}

export interface BenchmarkResult {
  id: string;
  config: BenchmarkConfig;
  startedAt: Date;
  completedAt: Date;
  duration: number; // seconds
  summary: ResultSummary;
  scenarios: ScenarioResult[];
  bottlenecks: Bottleneck[];
  recommendations: Recommendation[];
}

export interface ResultSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  throughput: number; // req/s
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  dataTransferred: number; // bytes
  peakVUs: number;
  errors: ErrorBreakdown[];
}

export interface ScenarioResult {
  name: string;
  requests: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  throughput: number;
  errors: number;
  endpoints: EndpointResult[];
}

export interface EndpointResult {
  path: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
}

export interface ErrorBreakdown {
  type: string; // 'timeout', '500', '429', 'connection_refused'
  count: number;
  percentage: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

export interface Bottleneck {
  component: 'api' | 'database' | 'redis' | 'llm' | 'network' | 'cpu' | 'memory';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  impact: string;
}

export interface Recommendation {
  priority: number;
  category: 'index' | 'cache' | 'pool' | 'query' | 'architecture' | 'scaling' | 'config';
  title: string;
  description: string;
  expectedImprovement: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
}

// ============================================================
// Benchmark Suite
// ============================================================

export class BenchmarkSuite {

  /**
   * 生成完整的 k6 压测脚本
   */
  generateK6Scripts(): Record<string, string> {
    return {
      'benchmarks/k6/scenarios/api-load.js': this.generateAPILoadTest(),
      'benchmarks/k6/scenarios/interview-flow.js': this.generateInterviewFlowTest(),
      'benchmarks/k6/scenarios/resume-bulk.js': this.generateResumeBulkTest(),
      'benchmarks/k6/scenarios/people-search.js': this.generatePeopleSearchTest(),
      'benchmarks/k6/scenarios/concurrent-1000.js': this.generateConcurrent1000Test(),
      'benchmarks/k6/config.js': this.generateK6Config(),
      'benchmarks/k6/helpers.js': this.generateHelpers(),
    };
  }

  private generateAPILoadTest(): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config, headers } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  scenarios: {
    // Ramp up to 500 VUs over 2 minutes, sustain for 10 minutes
    api_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '10m', target: 500 },
        { duration: '3m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
  },
};

export default function () {
  const scenarios = [
    { weight: 30, fn: healthCheck },
    { weight: 25, fn: resumeParse },
    { weight: 20, fn: peopleSearch },
    { weight: 15, fn: interviewStatus },
    { weight: 10, fn: workflowTrigger },
  ];

  // Weighted random selection
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const s of scenarios) {
    cumulative += s.weight;
    if (rand <= cumulative) {
      s.fn();
      break;
    }
  }

  sleep(Math.random() * 2 + 0.5); // Think time: 0.5-2.5s
}

function healthCheck() {
  const res = http.get(config.baseUrl + '/health/ready');
  check(res, { 'health 200': (r) => r.status === 200 });
  apiLatency.add(res.timings.duration);
}

function resumeParse() {
  const payload = JSON.stringify({
    content: 'Senior Software Engineer with 10 years experience in distributed systems...',
    format: 'text',
  });
  const res = http.post(config.baseUrl + '/api/v2/resume/parse', payload, { headers });
  const success = check(res, {
    'resume parse 200': (r) => r.status === 200,
    'has skills': (r) => JSON.parse(r.body).skills !== undefined,
  });
  errorRate.add(!success);
  apiLatency.add(res.timings.duration);
}

function peopleSearch() {
  const payload = JSON.stringify({
    query: 'Find senior backend engineers with Go and Kubernetes experience in Chengdu',
    limit: 20,
  });
  const res = http.post(config.baseUrl + '/api/v2/people/search', payload, { headers });
  const success = check(res, {
    'search 200': (r) => r.status === 200,
    'has results': (r) => JSON.parse(r.body).candidates?.length >= 0,
  });
  errorRate.add(!success);
  apiLatency.add(res.timings.duration);
}

function interviewStatus() {
  const res = http.get(config.baseUrl + '/api/v2/interview/sessions?limit=10', { headers });
  check(res, { 'interview list 200': (r) => r.status === 200 });
  apiLatency.add(res.timings.duration);
}

function workflowTrigger() {
  const payload = JSON.stringify({
    workflowId: 'resume-screening',
    input: { jobId: 'test-job-001', candidateIds: ['c1', 'c2', 'c3'] },
  });
  const res = http.post(config.baseUrl + '/api/v2/workflow/execute', payload, { headers });
  check(res, { 'workflow 200/202': (r) => r.status === 200 || r.status === 202 });
  apiLatency.add(res.timings.duration);
}
`;
  }

  private generateInterviewFlowTest(): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, headers } from '../config.js';

export const options = {
  scenarios: {
    interview_flow: {
      executor: 'constant-vus',
      vus: 50,
      duration: '15m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Interview flow allows higher latency (LLM)
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Full interview lifecycle
  
  // 1. Create session
  const createRes = http.post(config.baseUrl + '/api/v2/interview/sessions', JSON.stringify({
    candidateId: 'bench-candidate-' + __VU,
    jobId: 'bench-job-001',
    interviewType: 'behavioral',
  }), { headers });
  
  check(createRes, { 'session created': (r) => r.status === 200 || r.status === 201 });
  if (createRes.status !== 200 && createRes.status !== 201) return;
  
  const sessionId = JSON.parse(createRes.body).sessionId;
  sleep(1);

  // 2. Start interview
  const startRes = http.post(config.baseUrl + '/api/v2/interview/sessions/' + sessionId + '/start', null, { headers });
  check(startRes, { 'interview started': (r) => r.status === 200 });
  sleep(2);

  // 3. Submit audio chunks (simulate 5 chunks)
  for (let i = 0; i < 5; i++) {
    const chunkRes = http.post(config.baseUrl + '/api/v2/interview/sessions/' + sessionId + '/audio', JSON.stringify({
      chunk: 'base64_encoded_audio_data_chunk_' + i,
      sequence: i,
      timestamp: Date.now(),
    }), { headers });
    check(chunkRes, { 'audio accepted': (r) => r.status === 200 || r.status === 202 });
    sleep(3); // Simulate 3s audio chunks
  }

  // 4. End interview
  const endRes = http.post(config.baseUrl + '/api/v2/interview/sessions/' + sessionId + '/end', null, { headers });
  check(endRes, { 'interview ended': (r) => r.status === 200 });
  sleep(2);

  // 5. Get report
  const reportRes = http.get(config.baseUrl + '/api/v2/interview/sessions/' + sessionId + '/report', { headers });
  check(reportRes, { 'report available': (r) => r.status === 200 || r.status === 202 });
  
  sleep(5); // Cool down between interview flows
}
`;
  }

  private generateResumeBulkTest(): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { config, headers } from '../config.js';

// 10万简历批量处理测试
const resumesProcessed = new Counter('resumes_processed');
const parseLatency = new Trend('parse_latency');
const matchLatency = new Trend('match_latency');

export const options = {
  scenarios: {
    // Phase 1: Bulk upload (100 VUs × 1000 resumes each = 100K)
    bulk_parse: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1000,
      maxDuration: '60m',
    },
  },
  thresholds: {
    resumes_processed: ['count>=100000'],
    parse_latency: ['p(95)<3000'],
    match_latency: ['p(95)<5000'],
    http_req_failed: ['rate<0.02'],
  },
};

// Sample resume templates
const RESUME_TEMPLATES = [
  { title: 'Senior Backend Engineer', skills: ['Go', 'Kubernetes', 'PostgreSQL', 'gRPC'], years: 8 },
  { title: 'Frontend Developer', skills: ['React', 'TypeScript', 'Next.js', 'Tailwind'], years: 5 },
  { title: 'Data Scientist', skills: ['Python', 'PyTorch', 'SQL', 'Spark'], years: 6 },
  { title: 'DevOps Engineer', skills: ['Docker', 'Terraform', 'AWS', 'CI/CD'], years: 7 },
  { title: 'Product Manager', skills: ['Agile', 'User Research', 'SQL', 'Figma'], years: 4 },
  { title: 'ML Engineer', skills: ['Python', 'TensorFlow', 'MLOps', 'Kubernetes'], years: 5 },
  { title: 'Full Stack Developer', skills: ['Node.js', 'React', 'PostgreSQL', 'Redis'], years: 6 },
  { title: 'Security Engineer', skills: ['Penetration Testing', 'SOC', 'SIEM', 'Python'], years: 8 },
  { title: 'Mobile Developer', skills: ['React Native', 'Swift', 'Kotlin', 'Firebase'], years: 4 },
  { title: 'Cloud Architect', skills: ['AWS', 'Azure', 'GCP', 'Terraform', 'K8s'], years: 10 },
];

const JOB_DESCRIPTION = {
  title: 'Senior Software Engineer',
  requirements: ['5+ years experience', 'Distributed systems', 'Go or Java', 'Cloud native'],
  location: 'Chengdu',
};

export default function () {
  const template = RESUME_TEMPLATES[__ITER % RESUME_TEMPLATES.length];
  const resumeId = 'bench-resume-' + __VU + '-' + __ITER;

  // Step 1: Parse resume
  const parsePayload = JSON.stringify({
    id: resumeId,
    content: generateResumeContent(template, __VU, __ITER),
    format: 'text',
  });

  const parseStart = Date.now();
  const parseRes = http.post(config.baseUrl + '/api/v2/resume/parse', parsePayload, { headers });
  parseLatency.add(Date.now() - parseStart);

  const parseOk = check(parseRes, {
    'parse success': (r) => r.status === 200,
  });

  if (!parseOk) return;
  resumesProcessed.add(1);

  // Step 2: Match against JD (every 10th resume)
  if (__ITER % 10 === 0) {
    const matchPayload = JSON.stringify({
      resumeId: resumeId,
      jobDescription: JOB_DESCRIPTION,
    });

    const matchStart = Date.now();
    const matchRes = http.post(config.baseUrl + '/api/v2/resume/match', matchPayload, { headers });
    matchLatency.add(Date.now() - matchStart);

    check(matchRes, {
      'match success': (r) => r.status === 200,
      'has score': (r) => JSON.parse(r.body).score !== undefined,
    });
  }

  // Minimal think time for bulk processing
  sleep(0.1);
}

function generateResumeContent(template, vu, iter) {
  return template.title + ' - Candidate ' + vu + '-' + iter + '. ' +
    'Skills: ' + template.skills.join(', ') + '. ' +
    'Experience: ' + template.years + ' years. ' +
    'Education: Bachelor in Computer Science. ' +
    'Location: Chengdu, China. ' +
    'Achievements: Led team of ' + (3 + iter % 10) + ' engineers. ' +
    'Built systems handling ' + (1000 * (iter % 100 + 1)) + ' QPS.';
}
`;
  }

  private generatePeopleSearchTest(): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { config, headers } from '../config.js';

const searchLatency = new Trend('search_latency');

export const options = {
  scenarios: {
    people_search: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '3m', target: 50 },
      ],
    },
  },
  thresholds: {
    search_latency: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

const SEARCH_QUERIES = [
  'Find Go engineers with microservices experience in Chengdu',
  'Senior product managers with B2B SaaS background',
  'Data engineers proficient in Spark and Flink',
  'Frontend architects with React and performance optimization',
  'DevOps engineers with Kubernetes and Terraform',
  'AI/ML engineers with NLP and LLM experience',
  'Technical leads with team management experience',
  'Full stack developers with Node.js and React',
  'Security engineers with cloud security certification',
  'Mobile developers with cross-platform experience',
  'Backend engineers with high-concurrency system design',
  'Database administrators with PostgreSQL tuning experience',
  'Cloud architects with multi-cloud strategy',
  'QA engineers with automation testing frameworks',
  'Engineering managers with 50+ team experience',
];

export default function () {
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  
  const payload = JSON.stringify({
    query: query,
    filters: {
      location: Math.random() > 0.5 ? 'Chengdu' : undefined,
      minExperience: Math.floor(Math.random() * 5) + 3,
      maxResults: 20,
    },
  });

  const start = Date.now();
  const res = http.post(config.baseUrl + '/api/v2/people/search', payload, { headers });
  searchLatency.add(Date.now() - start);

  check(res, {
    'search 200': (r) => r.status === 200,
    'has candidates': (r) => {
      try { return JSON.parse(r.body).candidates?.length >= 0; }
      catch { return false; }
    },
    'response < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(Math.random() * 3 + 1); // 1-4s think time
}
`;
  }

  private generateConcurrent1000Test(): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, headers } from '../config.js';

// 1000并发压力测试 — 验证系统在极端负载下的表现
export const options = {
  scenarios: {
    spike_1000: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 1000 },  // Spike to 1000
        { duration: '5m', target: 1000 },   // Sustain 1000
        { duration: '1m', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'], // Allow 10% failure under extreme load
    http_reqs: ['rate>500'],         // Must sustain 500 req/s
  },
};

export default function () {
  // Mix of lightweight and heavy operations
  const rand = Math.random();

  if (rand < 0.40) {
    // 40% - Health/Status (lightweight)
    const res = http.get(config.baseUrl + '/health/ready');
    check(res, { 'health ok': (r) => r.status === 200 });
  } else if (rand < 0.70) {
    // 30% - Read operations
    const res = http.get(config.baseUrl + '/api/v2/console/dashboard', { headers });
    check(res, { 'dashboard ok': (r) => r.status === 200 || r.status === 401 });
  } else if (rand < 0.90) {
    // 20% - Search operations
    const res = http.post(config.baseUrl + '/api/v2/people/search', JSON.stringify({
      query: 'engineer',
      filters: { maxResults: 5 },
    }), { headers });
    check(res, { 'search ok': (r) => r.status === 200 || r.status === 429 });
  } else {
    // 10% - Write operations
    const res = http.post(config.baseUrl + '/api/v2/resume/parse', JSON.stringify({
      content: 'Test resume content for load testing VU ' + __VU,
      format: 'text',
    }), { headers });
    check(res, { 'parse ok': (r) => r.status === 200 || r.status === 429 });
  }

  sleep(Math.random() * 0.5); // Minimal think time for stress test
}
`;
  }

  private generateK6Config(): string {
    return `export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  apiKey: __ENV.API_KEY || 'test-api-key',
};

export const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + config.apiKey,
  'X-Tenant-ID': __ENV.TENANT_ID || 'bench-tenant',
};
`;
  }

  private generateHelpers(): string {
    return `import { sleep } from 'k6';

export function randomThinkTime(min = 0.5, max = 3) {
  sleep(Math.random() * (max - min) + min);
}

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateId(prefix = 'bench') {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}
`;
  }

  // ============================================================
  // Performance Analysis & Reporting
  // ============================================================

  analyzeResults(rawResults: unknown): BenchmarkResult {
    // Parse k6 JSON output and generate structured analysis
    const result: BenchmarkResult = {
      id: `bench_${Date.now()}`,
      config: {} as BenchmarkConfig,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        throughput: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        maxResponseTime: 0,
        dataTransferred: 0,
        peakVUs: 0,
        errors: [],
      },
      scenarios: [],
      bottlenecks: [],
      recommendations: [],
    };

    // Detect bottlenecks
    result.bottlenecks = this.detectBottlenecks(result.summary);
    result.recommendations = this.generateRecommendations(result.bottlenecks);

    return result;
  }

  private detectBottlenecks(summary: ResultSummary): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    if (summary.p95ResponseTime > 500) {
      bottlenecks.push({
        component: 'api',
        severity: summary.p95ResponseTime > 2000 ? 'critical' : 'high',
        description: 'API response time exceeds threshold',
        metric: 'p95_response_time',
        currentValue: summary.p95ResponseTime,
        threshold: 500,
        impact: 'User experience degradation, potential timeout errors',
      });
    }

    if (summary.successRate < 99) {
      bottlenecks.push({
        component: 'api',
        severity: summary.successRate < 95 ? 'critical' : 'high',
        description: 'Error rate exceeds acceptable threshold',
        metric: 'success_rate',
        currentValue: summary.successRate,
        threshold: 99,
        impact: 'Data loss, user frustration, SLA violation',
      });
    }

    if (summary.throughput < 500) {
      bottlenecks.push({
        component: 'api',
        severity: 'medium',
        description: 'Throughput below target for 1000 concurrent users',
        metric: 'throughput_rps',
        currentValue: summary.throughput,
        threshold: 500,
        impact: 'Cannot support target user base',
      });
    }

    return bottlenecks;
  }

  private generateRecommendations(bottlenecks: Bottleneck[]): Recommendation[] {
    const recommendations: Recommendation[] = [
      {
        priority: 1,
        category: 'index',
        title: 'Add composite indexes for hot queries',
        description: 'Create indexes on (tenant_id, created_at DESC) for all major tables',
        expectedImprovement: '60-80% reduction in query time for list operations',
        effort: 'low',
        implementation: 'CREATE INDEX CONCURRENTLY idx_xxx ON table(tenant_id, created_at DESC);',
      },
      {
        priority: 2,
        category: 'cache',
        title: 'Implement Redis caching for read-heavy endpoints',
        description: 'Cache dashboard data, search results, and user profiles with TTL',
        expectedImprovement: '70% reduction in DB load, 90% faster response for cached data',
        effort: 'medium',
        implementation: 'Redis cache-aside pattern with 60s TTL for dashboard, 300s for profiles',
      },
      {
        priority: 3,
        category: 'pool',
        title: 'Optimize connection pool settings',
        description: 'Increase DB pool to 50 connections, add PgBouncer for connection multiplexing',
        expectedImprovement: '40% improvement in concurrent request handling',
        effort: 'low',
        implementation: 'Set pool.max=50, idle_timeout=30s, add PgBouncer in transaction mode',
      },
      {
        priority: 4,
        category: 'query',
        title: 'Optimize N+1 queries in resume listing',
        description: 'Use JOIN or batch loading instead of sequential queries',
        expectedImprovement: '80% reduction in query count, 50% faster list endpoints',
        effort: 'medium',
        implementation: 'Replace findMany loops with single JOIN query + DataLoader pattern',
      },
      {
        priority: 5,
        category: 'architecture',
        title: 'Implement request queuing for LLM operations',
        description: 'Queue LLM requests with priority and rate limiting to prevent overload',
        expectedImprovement: 'Eliminate timeout errors under load, predictable latency',
        effort: 'high',
        implementation: 'Bull/BullMQ queue with concurrency=10, priority levels, retry with backoff',
      },
      {
        priority: 6,
        category: 'scaling',
        title: 'Configure HPA for auto-scaling',
        description: 'Set CPU threshold at 60%, scale 3-20 replicas based on load',
        expectedImprovement: 'Handle 10x traffic spikes without manual intervention',
        effort: 'low',
        implementation: 'HPA: minReplicas=3, maxReplicas=20, targetCPU=60%, scaleDown stabilization=300s',
      },
    ];

    return recommendations;
  }

  // ============================================================
  // Performance Baseline
  // ============================================================

  getPerformanceBaseline(): PerformanceBaseline {
    return {
      targets: {
        api: {
          p50: 100,   // ms
          p95: 500,   // ms
          p99: 1000,  // ms
          throughput: 1000, // req/s
          errorRate: 0.01,  // 1%
        },
        llm: {
          p50: 2000,  // ms (LLM operations are slower)
          p95: 5000,
          p99: 10000,
          throughput: 50, // req/s (limited by LLM)
          errorRate: 0.05,
        },
        database: {
          queryP95: 50,     // ms
          connectionPool: 50,
          maxConnections: 100,
          indexHitRate: 0.99,
        },
        redis: {
          p95: 5,      // ms
          hitRate: 0.85,
          memoryUsage: 0.70, // 70% max
        },
      },
      capacity: {
        concurrentUsers: 1000,
        resumesPerHour: 100000,
        interviewsPerHour: 500,
        searchesPerMinute: 200,
        workflowsPerHour: 1000,
      },
    };
  }
}

// ============================================================
// Supporting Types
// ============================================================

interface PerformanceBaseline {
  targets: {
    api: { p50: number; p95: number; p99: number; throughput: number; errorRate: number };
    llm: { p50: number; p95: number; p99: number; throughput: number; errorRate: number };
    database: { queryP95: number; connectionPool: number; maxConnections: number; indexHitRate: number };
    redis: { p95: number; hitRate: number; memoryUsage: number };
  };
  capacity: {
    concurrentUsers: number;
    resumesPerHour: number;
    interviewsPerHour: number;
    searchesPerMinute: number;
    workflowsPerHour: number;
  };
}

// ============================================================
// API Routes
// ============================================================

export const BENCHMARK_ROUTES = {
  'POST /api/v2/benchmark/run': 'startBenchmark',
  'GET /api/v2/benchmark/runs': 'listBenchmarkRuns',
  'GET /api/v2/benchmark/runs/:id': 'getBenchmarkResult',
  'GET /api/v2/benchmark/baseline': 'getPerformanceBaseline',
  'GET /api/v2/benchmark/recommendations': 'getRecommendations',
  'POST /api/v2/benchmark/compare': 'compareBenchmarks',
} as const;
