/**
 * 蓉才通™ ATOS — Workflow Multi-Agent Orchestrator
 * 
 * LangGraph-style DAG execution engine for multi-agent workflows.
 * Supports:
 * - Directed Acyclic Graph (DAG) node execution
 * - Conditional branching (router nodes)
 * - Parallel fan-out / fan-in
 * - State machine with typed channels
 * - Event Bus integration for real-time observability
 * - Audit Trail for compliance
 * - Retry / fallback / timeout per node
 * - Human-in-the-loop interrupt points
 */

import { eventBus as sharedEventBus } from '../shared/events/bus';
import { redis as sharedRedis } from '../shared/memory/redis';
import { llm as sharedLLM } from '../shared/llm/client';

// Derive types from singleton instances
type EventBusInstance = typeof sharedEventBus;
type RedisMemoryInstance = typeof sharedRedis;
type LLMClientInstance = typeof sharedLLM;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowState {
  [key: string]: unknown;
}

export interface NodeResult {
  output: Record<string, unknown>;
  nextNodes?: string[];  // Override default edges
  metadata?: Record<string, unknown>;
}

export type NodeExecutor = (
  state: WorkflowState,
  context: ExecutionContext
) => Promise<NodeResult>;

export type RouterFunction = (
  state: WorkflowState
) => string | string[];  // Return next node(s)

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'router' | 'tool' | 'human' | 'parallel';
  executor?: NodeExecutor;
  router?: RouterFunction;
  parallelNodes?: string[];  // For fan-out
  config: {
    timeout: number;       // ms
    retries: number;
    fallback?: string;     // Fallback node ID
    interruptBefore?: boolean;  // Human-in-the-loop
    interruptAfter?: boolean;
  };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;  // Optional label
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryPoint: string;
  endNodes: string[];
  channels: Record<string, { type: string; default?: unknown }>;
}

export interface ExecutionContext {
  workflowId: string;
  runId: string;
  nodeId: string;
  attempt: number;
  llm: LLMClientInstance;
  memory: RedisMemoryInstance;
  eventBus: EventBusInstance;
  emit: (event: string, data: unknown) => void;
}

export interface AuditEntry {
  timestamp: number;
  runId: string;
  nodeId: string;
  nodeType: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
  status: 'success' | 'error' | 'timeout' | 'skipped';
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled';
  state: WorkflowState;
  currentNodes: string[];
  completedNodes: string[];
  auditTrail: AuditEntry[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export class WorkflowOrchestrator {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private llm: LLMClientInstance;
  private memory: RedisMemoryInstance;
  private eventBus: EventBusInstance;

  constructor(llm: LLMClientInstance, memory: RedisMemoryInstance, eventBus: EventBusInstance) {
    this.llm = llm;
    this.memory = memory;
    this.eventBus = eventBus;
  }

  // ─── Workflow Registration ───────────────────────────────────────────────

  register(definition: WorkflowDefinition): void {
    this.validateDAG(definition);
    this.workflows.set(definition.id, definition);
  }

  private validateDAG(def: WorkflowDefinition): void {
    // Ensure no cycles (topological sort)
    const visited = new Set<string>();
    const stack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (stack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      stack.add(nodeId);
      const outEdges = def.edges.filter(e => e.from === nodeId);
      for (const edge of outEdges) {
        if (hasCycle(edge.to)) return true;
      }
      stack.delete(nodeId);
      return false;
    };

    for (const node of def.nodes) {
      if (hasCycle(node.id)) {
        throw new Error(`Workflow ${def.id} contains a cycle at node ${node.id}`);
      }
    }
  }

  // ─── Execution ─────────────────────────────────────────────────────────

  async execute(
    workflowId: string,
    initialState: WorkflowState = {}
  ): Promise<WorkflowRun> {
    const definition = this.workflows.get(workflowId);
    if (!definition) throw new Error(`Workflow ${workflowId} not found`);

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Initialize state with channel defaults
    const state: WorkflowState = { ...initialState };
    for (const [key, channel] of Object.entries(definition.channels)) {
      if (!(key in state) && channel.default !== undefined) {
        state[key] = channel.default;
      }
    }

    const run: WorkflowRun = {
      id: runId,
      workflowId,
      status: 'running',
      state,
      currentNodes: [definition.entryPoint],
      completedNodes: [],
      auditTrail: [],
      startedAt: Date.now(),
    };

    this.runs.set(runId, run);
    this.emitEvent('workflow:started', { runId, workflowId });

    // Persist to Redis
    await this.memory.setAgentMemory('workflow', runId, run, 86400);

    try {
      await this.executeLoop(run, definition);
    } catch (error) {
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : String(error);
      this.emitEvent('workflow:failed', { runId, error: run.error });
    }

    run.completedAt = Date.now();
    await this.memory.setAgentMemory('workflow', runId, run, 86400);
    return run;
  }

  private emitEvent(type: string, data: unknown): void {
    // Use publish for workflow events (EventBus emit requires EventPayload)
    try {
      this.eventBus.publish({
        type: 'agent:response' as any,
        tenantId: 'system',
        timestamp: new Date().toISOString(),
        data: { workflowEvent: type, ...data as object },
      });
    } catch {
      // Silently ignore if event bus is not connected
    }
  }

  private async executeLoop(
    run: WorkflowRun,
    definition: WorkflowDefinition
  ): Promise<void> {
    while (run.currentNodes.length > 0 && run.status === 'running') {
      const nodesToExecute = [...run.currentNodes];
      run.currentNodes = [];

      // Execute current nodes (potentially in parallel)
      const results = await Promise.allSettled(
        nodesToExecute.map(nodeId => this.executeNode(run, definition, nodeId))
      );

      // Process results and determine next nodes
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const nodeId = nodesToExecute[i];

        if (result.status === 'fulfilled') {
          run.completedNodes.push(nodeId);
          const nextNodes = result.value;
          for (const next of nextNodes) {
            if (!run.currentNodes.includes(next)) {
              run.currentNodes.push(next);
            }
          }
        } else {
          // Node failed — check fallback
          const node = definition.nodes.find(n => n.id === nodeId);
          if (node?.config.fallback) {
            run.currentNodes.push(node.config.fallback);
          } else {
            run.status = 'failed';
            run.error = result.reason?.message || 'Node execution failed';
            return;
          }
        }
      }

      // Check if we've reached an end node
      const reachedEnd = run.completedNodes.some(n => definition.endNodes.includes(n));
      if (reachedEnd && run.currentNodes.length === 0) {
        run.status = 'completed';
        this.emitEvent('workflow:completed', { runId: run.id, state: run.state });
      }
    }
  }

  private async executeNode(
    run: WorkflowRun,
    definition: WorkflowDefinition,
    nodeId: string
  ): Promise<string[]> {
    const node = definition.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in workflow`);

    const startTime = Date.now();
    const auditEntry: AuditEntry = {
      timestamp: startTime,
      runId: run.id,
      nodeId,
      nodeType: node.type,
      input: { ...run.state },
      output: {},
      duration: 0,
      status: 'success',
    };

    // Human-in-the-loop interrupt
    if (node.config.interruptBefore) {
      run.status = 'interrupted';
      this.emitEvent('workflow:interrupt', { runId: run.id, nodeId, type: 'before' });
      auditEntry.status = 'skipped';
      auditEntry.duration = Date.now() - startTime;
      run.auditTrail.push(auditEntry);
      return [];
    }

    this.emitEvent('workflow:node:start', { runId: run.id, nodeId, type: node.type });

    let nextNodes: string[] = [];

    try {
      switch (node.type) {
        case 'agent':
        case 'tool': {
          if (!node.executor) throw new Error(`Node ${nodeId} has no executor`);
          const context: ExecutionContext = {
            workflowId: definition.id,
            runId: run.id,
            nodeId,
            attempt: 1,
            llm: this.llm,
            memory: this.memory,
            eventBus: this.eventBus,
            emit: (event, data) => this.emitEvent(`workflow:${event}`, { runId: run.id, nodeId, ...data as object }),
          };

          // Execute with timeout and retry
          const result = await this.executeWithRetry(
            () => this.executeWithTimeout(node.executor!(run.state, context), node.config.timeout),
            node.config.retries,
            context
          );

          // Merge output into state
          Object.assign(run.state, result.output);
          auditEntry.output = result.output;

          // Determine next nodes
          nextNodes = result.nextNodes || this.getDefaultNextNodes(definition, nodeId);
          break;
        }

        case 'router': {
          if (!node.router) throw new Error(`Router node ${nodeId} has no router function`);
          const routeResult = node.router(run.state);
          nextNodes = Array.isArray(routeResult) ? routeResult : [routeResult];
          auditEntry.output = { route: nextNodes };
          break;
        }

        case 'parallel': {
          // Fan-out to parallel nodes
          nextNodes = node.parallelNodes || [];
          auditEntry.output = { fanOut: nextNodes };
          break;
        }

        case 'human': {
          run.status = 'interrupted';
          this.emitEvent('workflow:interrupt', { runId: run.id, nodeId, type: 'human' });
          auditEntry.status = 'skipped';
          break;
        }
      }
    } catch (error) {
      auditEntry.status = 'error';
      auditEntry.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      auditEntry.duration = Date.now() - startTime;
      run.auditTrail.push(auditEntry);
      this.emitEvent('workflow:node:end', {
        runId: run.id,
        nodeId,
        status: auditEntry.status,
        duration: auditEntry.duration,
      });
    }

    return nextNodes;
  }

  private getDefaultNextNodes(definition: WorkflowDefinition, nodeId: string): string[] {
    return definition.edges
      .filter(e => e.from === nodeId)
      .map(e => e.to);
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Node timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    context: ExecutionContext
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        context.attempt = attempt;
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt <= maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }
    throw lastError;
  }

  // ─── Run Management ────────────────────────────────────────────────────

  getRun(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId);
  }

  async resumeRun(runId: string, additionalState?: WorkflowState): Promise<WorkflowRun> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (run.status !== 'interrupted') throw new Error(`Run ${runId} is not interrupted`);

    const definition = this.workflows.get(run.workflowId);
    if (!definition) throw new Error(`Workflow ${run.workflowId} not found`);

    if (additionalState) {
      Object.assign(run.state, additionalState);
    }

    run.status = 'running';
    // Move to next nodes from the interrupted node
    const interruptedNode = run.auditTrail[run.auditTrail.length - 1]?.nodeId;
    if (interruptedNode) {
      run.completedNodes.push(interruptedNode);
      run.currentNodes = this.getDefaultNextNodes(definition, interruptedNode);
    }

    await this.executeLoop(run, definition);
    run.completedAt = Date.now();
    await this.memory.setAgentMemory('workflow', runId, run, 86400);
    return run;
  }

  cancelRun(runId: string): void {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'cancelled';
      run.completedAt = Date.now();
      this.emitEvent('workflow:cancelled', { runId });
    }
  }

  getAuditTrail(runId: string): AuditEntry[] {
    return this.runs.get(runId)?.auditTrail || [];
  }
}

// ─── Pre-built Workflow Definitions ──────────────────────────────────────────

export const INTERVIEW_WORKFLOW: WorkflowDefinition = {
  id: 'interview-full',
  name: 'Full Interview Pipeline',
  version: '1.0.0',
  entryPoint: 'start',
  endNodes: ['generate-report'],
  channels: {
    sessionId: { type: 'string' },
    candidateId: { type: 'string' },
    positionId: { type: 'string' },
    transcript: { type: 'array', default: [] },
    scores: { type: 'object', default: {} },
    starAnalysis: { type: 'array', default: [] },
    competencyScores: { type: 'object', default: {} },
    followupQuestions: { type: 'array', default: [] },
    report: { type: 'object', default: null },
  },
  nodes: [
    { id: 'start', type: 'tool', config: { timeout: 5000, retries: 0 }, executor: async (state) => ({ output: { status: 'started', startedAt: Date.now() } }) },
    { id: 'transcribe', type: 'agent', config: { timeout: 30000, retries: 2 }, executor: async (state, ctx) => {
      ctx.emit('transcribing', { sessionId: state.sessionId });
      return { output: { transcriptReady: true } };
    }},
    { id: 'analyze-parallel', type: 'parallel', parallelNodes: ['star-analysis', 'competency-eval', 'scoring'], config: { timeout: 0, retries: 0 } },
    { id: 'star-analysis', type: 'agent', config: { timeout: 15000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('star-analyzing', {});
      return { output: { starComplete: true } };
    }},
    { id: 'competency-eval', type: 'agent', config: { timeout: 15000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('competency-evaluating', {});
      return { output: { competencyComplete: true } };
    }},
    { id: 'scoring', type: 'agent', config: { timeout: 10000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('scoring', {});
      return { output: { scoringComplete: true } };
    }},
    { id: 'followup-router', type: 'router', router: (state) => {
      // If score is low or STAR incomplete, generate followup
      return state.needsFollowup ? 'generate-followup' : 'generate-report';
    }, config: { timeout: 0, retries: 0 } },
    { id: 'generate-followup', type: 'agent', config: { timeout: 10000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('generating-followup', {});
      return { output: { followupGenerated: true } };
    }},
    { id: 'human-review', type: 'human', config: { timeout: 0, retries: 0, interruptBefore: true } },
    { id: 'generate-report', type: 'agent', config: { timeout: 30000, retries: 2 }, executor: async (state, ctx) => {
      ctx.emit('generating-report', {});
      return { output: { reportGenerated: true, completedAt: Date.now() } };
    }},
  ],
  edges: [
    { from: 'start', to: 'transcribe' },
    { from: 'transcribe', to: 'analyze-parallel' },
    { from: 'star-analysis', to: 'followup-router' },
    { from: 'competency-eval', to: 'followup-router' },
    { from: 'scoring', to: 'followup-router' },
    { from: 'followup-router', to: 'generate-followup', condition: 'needs_followup' },
    { from: 'followup-router', to: 'generate-report', condition: 'complete' },
    { from: 'generate-followup', to: 'human-review' },
    { from: 'human-review', to: 'generate-report' },
  ],
};

export const RESUME_SCREENING_WORKFLOW: WorkflowDefinition = {
  id: 'resume-screening',
  name: 'Resume Screening Pipeline',
  version: '1.0.0',
  entryPoint: 'parse',
  endNodes: ['output-rankings'],
  channels: {
    resumeIds: { type: 'array', default: [] },
    positionId: { type: 'string' },
    parsedResumes: { type: 'array', default: [] },
    skillAnalysis: { type: 'array', default: [] },
    riskFlags: { type: 'array', default: [] },
    rankings: { type: 'array', default: [] },
  },
  nodes: [
    { id: 'parse', type: 'agent', config: { timeout: 60000, retries: 2 }, executor: async (state, ctx) => {
      ctx.emit('parsing', { count: (state.resumeIds as string[]).length });
      return { output: { parseComplete: true } };
    }},
    { id: 'parallel-analysis', type: 'parallel', parallelNodes: ['skill-extract', 'risk-detect'], config: { timeout: 0, retries: 0 } },
    { id: 'skill-extract', type: 'agent', config: { timeout: 30000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('extracting-skills', {});
      return { output: { skillsExtracted: true } };
    }},
    { id: 'risk-detect', type: 'agent', config: { timeout: 20000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('detecting-risks', {});
      return { output: { risksDetected: true } };
    }},
    { id: 'rank', type: 'agent', config: { timeout: 20000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('ranking', {});
      return { output: { ranked: true } };
    }},
    { id: 'explain', type: 'agent', config: { timeout: 15000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('explaining', {});
      return { output: { explained: true } };
    }},
    { id: 'output-rankings', type: 'tool', config: { timeout: 5000, retries: 0 }, executor: async (state) => {
      return { output: { complete: true, outputAt: Date.now() } };
    }},
  ],
  edges: [
    { from: 'parse', to: 'parallel-analysis' },
    { from: 'skill-extract', to: 'rank' },
    { from: 'risk-detect', to: 'rank' },
    { from: 'rank', to: 'explain' },
    { from: 'explain', to: 'output-rankings' },
  ],
};

export const PEOPLE_SEARCH_WORKFLOW: WorkflowDefinition = {
  id: 'people-search',
  name: 'PeopleGPT Search Pipeline',
  version: '1.0.0',
  entryPoint: 'parse-query',
  endNodes: ['output-results'],
  channels: {
    naturalLanguageQuery: { type: 'string' },
    structuredQuery: { type: 'object', default: null },
    searchResults: { type: 'array', default: [] },
    rankedResults: { type: 'array', default: [] },
    outreachEmails: { type: 'array', default: [] },
  },
  nodes: [
    { id: 'parse-query', type: 'agent', config: { timeout: 10000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('parsing-query', { query: state.naturalLanguageQuery });
      return { output: { queryParsed: true } };
    }},
    { id: 'hybrid-search', type: 'agent', config: { timeout: 20000, retries: 2 }, executor: async (state, ctx) => {
      ctx.emit('searching', {});
      return { output: { searchComplete: true } };
    }},
    { id: 'rank-results', type: 'agent', config: { timeout: 15000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('ranking', {});
      return { output: { rankingComplete: true } };
    }},
    { id: 'outreach-router', type: 'router', router: (state) => {
      return state.generateOutreach ? 'generate-outreach' : 'output-results';
    }, config: { timeout: 0, retries: 0 } },
    { id: 'generate-outreach', type: 'agent', config: { timeout: 20000, retries: 1 }, executor: async (state, ctx) => {
      ctx.emit('generating-outreach', {});
      return { output: { outreachGenerated: true } };
    }},
    { id: 'output-results', type: 'tool', config: { timeout: 5000, retries: 0 }, executor: async (state) => {
      return { output: { complete: true } };
    }},
  ],
  edges: [
    { from: 'parse-query', to: 'hybrid-search' },
    { from: 'hybrid-search', to: 'rank-results' },
    { from: 'rank-results', to: 'outreach-router' },
    { from: 'outreach-router', to: 'generate-outreach', condition: 'outreach_requested' },
    { from: 'outreach-router', to: 'output-results', condition: 'search_only' },
    { from: 'generate-outreach', to: 'output-results' },
  ],
};
