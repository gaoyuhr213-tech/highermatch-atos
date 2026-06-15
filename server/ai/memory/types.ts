/**
 * 蓉才通™ ATOS — Memory OS Type Definitions
 * 
 * 对标：OpenAI Memory / Claude Memory / LangGraph Memory / Mem0
 * 
 * 六层记忆架构：
 * 1. Session Memory — 会话级短期记忆（Redis TTL，分钟级）
 * 2. User Memory — 用户长期偏好/行为（Postgres，永久）
 * 3. Candidate Memory — 候选人画像记忆（Postgres + pgvector）
 * 4. Recruiter Memory — 招聘官偏好/决策模式（Postgres）
 * 5. Semantic Memory — 语义知识记忆（pgvector embedding 检索）
 * 6. Episodic Memory — 情景记忆（事件序列 + 时间衰减）
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export type MemoryType = 'session' | 'user' | 'candidate' | 'recruiter' | 'semantic' | 'episodic';

export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low' | 'trivial';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  subjectId: string;       // who this memory belongs to
  tenantId: string;
  content: string;         // natural language memory content
  summary?: string;        // compressed summary
  embedding?: number[];    // vector representation (1536-dim)
  importance: MemoryImportance;
  accessCount: number;     // retrieval frequency
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;      // optional TTL
  metadata: MemoryMetadata;
  tags: string[];
  source: MemorySource;
}

export interface MemoryMetadata {
  agentId?: string;        // which agent created this memory
  sessionId?: string;      // originating session
  context?: string;        // contextual information
  confidence?: number;     // 0-1 confidence score
  decay?: number;          // time decay factor (0-1, 1=fresh)
  relations?: MemoryRelation[];  // links to other memories
  [key: string]: unknown;
}

export interface MemoryRelation {
  targetId: string;
  relationType: 'supports' | 'contradicts' | 'extends' | 'replaces' | 'related';
  strength: number;  // 0-1
}

export interface MemorySource {
  type: 'agent' | 'user_input' | 'system' | 'reflection' | 'observation';
  agentName?: string;
  timestamp: string;
  rawInput?: string;
}

// ─── Session Memory ──────────────────────────────────────────────────────────

export interface SessionMemoryEntry {
  key: string;
  value: unknown;
  ttlSeconds: number;
  createdAt: string;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  turns: ConversationTurn[];
  workingMemory: Record<string, unknown>;  // scratch pad for current session
  shortTermFacts: string[];                // facts extracted this session
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── User Memory ─────────────────────────────────────────────────────────────

export interface UserMemoryProfile {
  userId: string;
  tenantId: string;
  preferences: UserPreferences;
  behaviorPatterns: BehaviorPattern[];
  interactionHistory: InteractionSummary[];
  personalFacts: string[];        // "prefers morning interviews", "speaks Mandarin and English"
  lastUpdated: string;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  communicationStyle: 'formal' | 'casual' | 'technical';
  notificationPreferences: Record<string, boolean>;
  uiPreferences: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BehaviorPattern {
  pattern: string;           // natural language description
  frequency: number;         // times observed
  lastObserved: string;
  confidence: number;        // 0-1
}

export interface InteractionSummary {
  date: string;
  type: string;
  outcome: string;
  keyInsights: string[];
}

// ─── Candidate Memory ────────────────────────────────────────────────────────

export interface CandidateMemoryProfile {
  candidateId: string;
  tenantId: string;
  // Structured facts
  skills: SkillMemory[];
  experiences: ExperienceMemory[];
  assessments: AssessmentMemory[];
  // Behavioral signals
  interviewSignals: InterviewSignal[];
  communicationStyle: string;
  strengthAreas: string[];
  developmentAreas: string[];
  // Semantic
  embedding?: number[];
  lastUpdated: string;
}

export interface SkillMemory {
  skill: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  evidence: string[];        // sources that confirm this skill
  lastValidated: string;
  confidence: number;
}

export interface ExperienceMemory {
  company: string;
  role: string;
  duration: string;
  keyAchievements: string[];
  relevanceScore: number;    // 0-100
}

export interface AssessmentMemory {
  type: 'interview' | 'resume' | 'reference' | 'test';
  date: string;
  scores: Record<string, number>;
  summary: string;
  assessorId?: string;
}

export interface InterviewSignal {
  sessionId: string;
  date: string;
  competency: string;
  score: number;
  evidence: string;
  starStructure?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

// ─── Recruiter Memory ────────────────────────────────────────────────────────

export interface RecruiterMemoryProfile {
  recruiterId: string;
  tenantId: string;
  hiringPatterns: HiringPattern[];
  decisionPreferences: DecisionPreference[];
  feedbackHistory: RecruiterFeedback[];
  successMetrics: SuccessMetric[];
  lastUpdated: string;
}

export interface HiringPattern {
  pattern: string;           // "tends to prioritize cultural fit over technical skills"
  evidence: string[];
  frequency: number;
  lastObserved: string;
}

export interface DecisionPreference {
  dimension: string;         // "experience_weight", "education_weight", etc.
  value: number;             // normalized weight 0-1
  derivedFrom: string[];     // past decisions that inform this
}

export interface RecruiterFeedback {
  candidateId: string;
  positionId: string;
  decision: 'advance' | 'reject' | 'hold';
  reasoning: string;
  date: string;
}

export interface SuccessMetric {
  metric: string;            // "hire_retention_90d", "time_to_fill"
  value: number;
  period: string;
}

// ─── Semantic Memory ─────────────────────────────────────────────────────────

export interface SemanticMemoryEntry {
  id: string;
  content: string;
  embedding: number[];       // 1536-dim vector
  category: string;          // 'skill_definition', 'industry_knowledge', 'company_culture', etc.
  source: string;
  confidence: number;
  createdAt: string;
  accessCount: number;
}

// ─── Episodic Memory ─────────────────────────────────────────────────────────

export interface EpisodicMemoryEntry {
  id: string;
  subjectId: string;
  episode: string;           // natural language description of what happened
  participants: string[];
  context: string;
  outcome: string;
  emotionalValence: number;  // -1 to 1 (negative to positive)
  importance: number;        // 0-1
  timestamp: string;
  decay: number;             // current decay factor (1 = fresh, 0 = forgotten)
  linkedEpisodes: string[];  // related episode IDs
}

// ─── Memory Retrieval ────────────────────────────────────────────────────────

export interface MemoryQuery {
  query: string;             // natural language query
  queryEmbedding?: number[]; // pre-computed embedding
  types?: MemoryType[];      // filter by memory type
  subjectId?: string;        // filter by subject
  tenantId: string;
  limit?: number;            // max results (default 10)
  minImportance?: MemoryImportance;
  minConfidence?: number;    // 0-1
  timeRange?: {
    from?: string;
    to?: string;
  };
  includeDecayed?: boolean;  // include memories with high decay
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevanceScore: number;    // 0-1 combined score
  semanticScore: number;     // vector similarity
  recencyScore: number;      // time-based score
  importanceScore: number;   // importance weight
  accessScore: number;       // frequency weight
}

// ─── Memory Injection (for Agent Context) ────────────────────────────────────

export interface MemoryInjection {
  sessionMemory: string[];       // current session facts
  relevantMemories: string[];    // retrieved long-term memories
  userPreferences: string[];     // user-specific context
  candidateContext: string[];    // candidate-specific (if applicable)
  recruiterContext: string[];    // recruiter preferences (if applicable)
  episodicContext: string[];     // relevant past episodes
}

// ─── Memory Compression & Reflection ─────────────────────────────────────────

export interface CompressionResult {
  originalCount: number;
  compressedCount: number;
  summary: string;
  retainedIds: string[];
  mergedIds: string[];
  discardedIds: string[];
}

export interface ReflectionResult {
  insights: string[];            // new insights derived from reflection
  patterns: string[];            // detected patterns
  contradictions: string[];      // conflicting memories found
  recommendations: string[];     // suggested actions
  newMemories: Partial<MemoryEntry>[];  // memories to create from reflection
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface IMemoryStore {
  // CRUD
  create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry>;
  delete(id: string): Promise<void>;
  
  // Search
  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
  searchByEmbedding(embedding: number[], limit: number, filters?: Partial<MemoryQuery>): Promise<MemorySearchResult[]>;
  
  // Bulk operations
  getBySubject(subjectId: string, type?: MemoryType): Promise<MemoryEntry[]>;
  getRecent(tenantId: string, limit: number, type?: MemoryType): Promise<MemoryEntry[]>;
  
  // Maintenance
  applyDecay(olderThan: string, decayFactor: number): Promise<number>;
  compress(subjectId: string, type: MemoryType): Promise<CompressionResult>;
  prune(olderThan: string, belowImportance: MemoryImportance): Promise<number>;
}

export interface IMemoryRetriever {
  retrieve(query: MemoryQuery): Promise<MemoryInjection>;
  buildContext(sessionId: string, userId: string, candidateId?: string, recruiterId?: string): Promise<MemoryInjection>;
}
