/**
 * 蓉才通™ ATOS — Evaluation Framework Types
 * 
 * Agent 评估系统，对标：
 * - OpenAI Evals
 * - LangSmith Evaluation
 * - Braintrust
 * - RAGAS (RAG Assessment)
 * 
 * 评估维度：
 * 1. Accuracy — 输出正确性
 * 2. Faithfulness — 是否忠于输入/上下文
 * 3. Relevance — 输出与查询的相关性
 * 4. Toxicity — 有害内容检测
 * 5. Latency — 响应时间
 * 6. Cost — Token 消耗
 * 7. Consistency — 多次调用一致性
 * 8. Hallucination — 幻觉检测
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export type EvalMetric = 
  | 'accuracy'
  | 'faithfulness'
  | 'relevance'
  | 'toxicity'
  | 'latency'
  | 'cost'
  | 'consistency'
  | 'hallucination'
  | 'completeness'
  | 'coherence'
  | 'custom';

export type EvalStatus = 'pending' | 'running' | 'completed' | 'failed';

export type EvalGrade = 'pass' | 'fail' | 'partial' | 'skip';

// ─── Eval Suite ──────────────────────────────────────────────────────────────

export interface EvalSuite {
  id: string;
  name: string;
  description: string;
  agentName: string;
  version: string;
  cases: EvalCase[];
  metrics: EvalMetric[];
  thresholds: Record<EvalMetric, number>;  // minimum score to pass
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  name: string;
  description?: string;
  input: EvalInput;
  expectedOutput?: EvalExpectedOutput;
  tags: string[];
  weight: number;  // importance weight (0-1)
}

export interface EvalInput {
  messages?: Array<{ role: string; content: string }>;
  query?: string;
  context?: string;
  documents?: string[];
  metadata?: Record<string, unknown>;
}

export interface EvalExpectedOutput {
  content?: string;           // exact or fuzzy match
  contains?: string[];        // must contain these strings
  notContains?: string[];     // must NOT contain these
  jsonSchema?: Record<string, unknown>;  // output must match schema
  factualClaims?: string[];   // verifiable facts that should be present
  customValidator?: string;   // function name for custom validation
}

// ─── Eval Run ────────────────────────────────────────────────────────────────

export interface EvalRun {
  id: string;
  suiteId: string;
  suiteName: string;
  agentName: string;
  status: EvalStatus;
  startedAt: string;
  completedAt?: string;
  results: EvalCaseResult[];
  summary: EvalRunSummary;
  config: EvalRunConfig;
  metadata: Record<string, unknown>;
}

export interface EvalRunConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  parallelism: number;
  retryOnFailure: boolean;
  timeoutMs: number;
}

export interface EvalCaseResult {
  caseId: string;
  caseName: string;
  status: EvalStatus;
  grade: EvalGrade;
  scores: Record<EvalMetric, number>;  // 0-1 for each metric
  output: string;
  latencyMs: number;
  tokenUsage: { prompt: number; completion: number; total: number };
  reasoning: string;  // why this grade was given
  error?: string;
}

export interface EvalRunSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  partialCases: number;
  skippedCases: number;
  averageScores: Record<EvalMetric, number>;
  overallGrade: EvalGrade;
  overallScore: number;  // 0-100
  totalLatencyMs: number;
  totalTokens: number;
  estimatedCost: number;  // USD
  regressions: EvalRegression[];
}

export interface EvalRegression {
  caseId: string;
  caseName: string;
  metric: EvalMetric;
  previousScore: number;
  currentScore: number;
  delta: number;
}

// ─── Eval Judges ─────────────────────────────────────────────────────────────

export interface EvalJudge {
  type: 'llm' | 'rule' | 'human' | 'composite';
  name: string;
  config: EvalJudgeConfig;
}

export interface EvalJudgeConfig {
  // LLM Judge
  model?: string;
  systemPrompt?: string;
  rubric?: string;
  
  // Rule Judge
  rules?: EvalRule[];
  
  // Composite
  judges?: EvalJudge[];
  aggregation?: 'average' | 'min' | 'max' | 'majority';
}

export interface EvalRule {
  type: 'contains' | 'not_contains' | 'regex' | 'json_valid' | 'length' | 'custom';
  value: string | number;
  weight: number;
}

// ─── Eval Dataset ────────────────────────────────────────────────────────────

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  agentName: string;
  entries: EvalDatasetEntry[];
  version: string;
  createdAt: string;
}

export interface EvalDatasetEntry {
  id: string;
  input: string;
  expectedOutput: string;
  context?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// ─── Eval Comparison ─────────────────────────────────────────────────────────

export interface EvalComparison {
  runA: EvalRun;
  runB: EvalRun;
  improvements: EvalDiff[];
  regressions: EvalDiff[];
  unchanged: string[];  // case IDs
  overallDelta: number;
}

export interface EvalDiff {
  caseId: string;
  caseName: string;
  metric: EvalMetric;
  scoreA: number;
  scoreB: number;
  delta: number;
  significance: 'high' | 'medium' | 'low';
}

// ─── Hallucination Detection ─────────────────────────────────────────────────

export interface HallucinationCheck {
  output: string;
  context: string[];
  claims: ClaimVerification[];
  hallucinationScore: number;  // 0-1 (0 = no hallucination)
  unsupportedClaims: string[];
}

export interface ClaimVerification {
  claim: string;
  supported: boolean;
  evidence?: string;
  confidence: number;
}

// ─── A/B Testing ─────────────────────────────────────────────────────────────

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variantA: ABVariant;
  variantB: ABVariant;
  metrics: EvalMetric[];
  sampleSize: number;
  currentSamples: number;
  status: 'active' | 'completed' | 'cancelled';
  results?: ABTestResults;
  createdAt: string;
}

export interface ABVariant {
  name: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  config: Record<string, unknown>;
}

export interface ABTestResults {
  winner: 'A' | 'B' | 'tie';
  confidence: number;  // statistical confidence (0-1)
  metricResults: Record<EvalMetric, {
    meanA: number;
    meanB: number;
    pValue: number;
    significant: boolean;
  }>;
}
