/**
 * 蓉才通™ ATOS — Recruiting Operator
 * 
 * 自然语言招聘指挥中心 — "Ask ATOS"
 * 
 * 对标：
 * - OpenAI Operator
 * - Palantir AIP
 * - Anthropic Computer Use
 * 
 * 核心能力：
 * - 自然语言 → 多 Agent 编排执行
 * - 自动调用：PeopleGPT → Resume Intelligence → Interview → Ranking → Explanation
 * - 形成真正的 Recruiting Operator
 * 
 * 示例指令：
 * - "帮我找到最适合这个岗位的人"
 * - "为什么推荐他？"
 * - "谁风险最高？"
 * - "谁应该进入终面？"
 * - "帮我安排下周的面试"
 * - "生成这个候选人的完整评估报告"
 */

import { llm } from '../shared/llm/client';
import { memory } from '../memory';
import { observe } from '../observability';
import { hitl } from '../hitl';
import { logger } from '../observability';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OperatorIntent = 
  | 'search_candidates'
  | 'rank_candidates'
  | 'explain_recommendation'
  | 'assess_risk'
  | 'schedule_interview'
  | 'generate_report'
  | 'compare_candidates'
  | 'suggest_questions'
  | 'draft_outreach'
  | 'pipeline_status'
  | 'general_query'
  | 'multi_step';

export interface OperatorCommand {
  id: string;
  tenantId: string;
  userId: string;
  input: string;  // natural language input
  intent: OperatorIntent;
  entities: ExtractedEntities;
  plan: ExecutionPlan;
  status: 'planning' | 'executing' | 'waiting_human' | 'completed' | 'failed';
  results: OperatorResult[];
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface ExtractedEntities {
  jobTitle?: string;
  jobId?: string;
  candidateNames?: string[];
  candidateIds?: string[];
  skills?: string[];
  location?: string;
  experience?: string;
  timeframe?: string;
  criteria?: string[];
  quantity?: number;
}

export interface ExecutionPlan {
  steps: PlanStep[];
  estimatedDuration_ms: number;
  requiresHumanApproval: boolean;
  confidence: number;
}

export interface PlanStep {
  id: string;
  order: number;
  agent: string;
  action: string;
  input: unknown;
  dependsOn: string[];  // step IDs
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
  duration_ms?: number;
}

export interface OperatorResult {
  stepId: string;
  agent: string;
  action: string;
  data: unknown;
  summary: string;
  confidence: number;
}

// ─── Operator Engine ─────────────────────────────────────────────────────────

export class RecruitingOperator {
  /**
   * Process a natural language command from a recruiter.
   * This is the main entry point — "Ask ATOS".
   */
  async process(input: string, tenantId: string, userId: string): Promise<OperatorCommand> {
    const commandId = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const ctx = observe.startTrace('recruiting-operator', tenantId, { userId });

    const command: OperatorCommand = {
      id: commandId,
      tenantId,
      userId,
      input,
      intent: 'general_query',
      entities: {},
      plan: { steps: [], estimatedDuration_ms: 0, requiresHumanApproval: false, confidence: 0 },
      status: 'planning',
      results: [],
      startedAt: new Date().toISOString(),
      metadata: {},
    };

    try {
      // Step 1: Intent Classification + Entity Extraction
      const understanding = await this.understand(input, tenantId, userId);
      command.intent = understanding.intent;
      command.entities = understanding.entities;

      // Step 2: Memory-augmented context
      const memoryContext = await memory.buildContext('operator', userId);
      const memoryPrompt = memory.formatForPrompt(memoryContext);

      // Step 3: Plan generation
      command.plan = await this.plan(command.intent, command.entities, memoryPrompt);
      command.status = 'executing';

      // Step 4: Execute plan
      for (const step of command.plan.steps) {
        // Check dependencies
        const depsComplete = step.dependsOn.every(depId => {
          const dep = command.plan.steps.find(s => s.id === depId);
          return dep?.status === 'completed';
        });
        if (!depsComplete) {
          step.status = 'skipped';
          continue;
        }

        step.status = 'running';
        const stepSpan = ctx.span(`step:${step.agent}:${step.action}`, 'agent');

        try {
          const result = await this.executeStep(step, command);
          step.status = 'completed';
          step.output = result.data;
          step.duration_ms = Date.now() - new Date(command.startedAt).getTime();
          command.results.push(result);
          stepSpan.end(result);
        } catch (error) {
          step.status = 'failed';
          stepSpan.error(error instanceof Error ? error : new Error(String(error)));
          logger.error('[Operator] Step failed', { stepId: step.id, error });
        }
      }

      // Step 5: Generate final response
      command.status = 'completed';
      command.completedAt = new Date().toISOString();

      // Persist learnings to memory
      await this.persistLearnings(command, userId, tenantId);

    } catch (error) {
      command.status = 'failed';
      logger.error('[Operator] Command failed', { commandId, error });
    }

    ctx.end(command.status === 'completed' ? 'success' : 'error');
    return command;
  }

  /**
   * Generate a natural language response from operator results.
   */
  async respond(command: OperatorCommand): Promise<string> {
    if (command.results.length === 0) {
      return '抱歉，我无法完成这个请求。请提供更多细节。';
    }

    const resultSummaries = command.results.map(r => `[${r.agent}] ${r.summary}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `你是蓉才通™ ATOS 的招聘指挥官（Recruiting Operator）。
基于以下 Agent 执行结果，用专业、简洁的中文回答用户的问题。
要求：
- 结论先行，数据支撑
- 给出明确的行动建议
- 如有风险，主动提示
- 使用结构化格式（标题、列表、表格）`,
        },
        {
          role: 'user',
          content: `用户问题：${command.input}\n\n执行结果：\n${resultSummaries}\n\n详细数据：${JSON.stringify(command.results.map(r => r.data)).substring(0, 3000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      metadata: { tenantId: command.tenantId, agentName: 'operator-responder' },
    });

    return response.content;
  }

  // ─── Intent Understanding ──────────────────────────────────────────────────

  private async understand(input: string, tenantId: string, userId: string): Promise<{
    intent: OperatorIntent;
    entities: ExtractedEntities;
  }> {
    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for a recruiting AI system.
Given a recruiter's natural language command, extract:
1. Intent (one of: search_candidates, rank_candidates, explain_recommendation, assess_risk, schedule_interview, generate_report, compare_candidates, suggest_questions, draft_outreach, pipeline_status, general_query, multi_step)
2. Entities (job title, candidate names, skills, location, experience, criteria, etc.)

Return JSON:
{
  "intent": "...",
  "entities": {
    "jobTitle": "...",
    "candidateNames": [...],
    "skills": [...],
    "location": "...",
    "experience": "...",
    "criteria": [...],
    "quantity": null or number
  },
  "confidence": 0.0-1.0
}`,
        },
        { role: 'user', content: input },
      ],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      metadata: { tenantId, agentName: 'operator-classifier' },
    });

    const parsed = JSON.parse(response.content);
    return {
      intent: parsed.intent || 'general_query',
      entities: parsed.entities || {},
    };
  }

  // ─── Plan Generation ───────────────────────────────────────────────────────

  private async plan(intent: OperatorIntent, entities: ExtractedEntities, memoryContext: string): Promise<ExecutionPlan> {
    // Predefined execution plans for common intents
    switch (intent) {
      case 'search_candidates':
        return this.planSearchCandidates(entities);
      case 'rank_candidates':
        return this.planRankCandidates(entities);
      case 'explain_recommendation':
        return this.planExplainRecommendation(entities);
      case 'assess_risk':
        return this.planAssessRisk(entities);
      case 'generate_report':
        return this.planGenerateReport(entities);
      case 'compare_candidates':
        return this.planCompareCandidates(entities);
      case 'suggest_questions':
        return this.planSuggestQuestions(entities);
      case 'draft_outreach':
        return this.planDraftOutreach(entities);
      case 'pipeline_status':
        return this.planPipelineStatus(entities);
      default:
        return this.planGeneral(intent, entities);
    }
  }

  private planSearchCandidates(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'people-search', action: 'search', input: entities, dependsOn: [], status: 'pending' },
        { id: 's2', order: 2, agent: 'resume-ranker', action: 'rank', input: { topN: entities.quantity || 10 }, dependsOn: ['s1'], status: 'pending' },
        { id: 's3', order: 3, agent: 'explainer', action: 'explain_ranking', input: {}, dependsOn: ['s2'], status: 'pending' },
      ],
      estimatedDuration_ms: 15000,
      requiresHumanApproval: false,
      confidence: 0.85,
    };
  }

  private planRankCandidates(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'resume-intelligence', action: 'batch_score', input: entities, dependsOn: [], status: 'pending' },
        { id: 's2', order: 2, agent: 'ranking-agent', action: 'rank_by_fit', input: {}, dependsOn: ['s1'], status: 'pending' },
      ],
      estimatedDuration_ms: 10000,
      requiresHumanApproval: false,
      confidence: 0.9,
    };
  }

  private planExplainRecommendation(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'explainer', action: 'explain_candidate', input: entities, dependsOn: [], status: 'pending' },
      ],
      estimatedDuration_ms: 5000,
      requiresHumanApproval: false,
      confidence: 0.9,
    };
  }

  private planAssessRisk(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'resume-intelligence', action: 'risk_analysis', input: entities, dependsOn: [], status: 'pending' },
        { id: 's2', order: 2, agent: 'scoring-agent', action: 'risk_score', input: {}, dependsOn: ['s1'], status: 'pending' },
      ],
      estimatedDuration_ms: 8000,
      requiresHumanApproval: false,
      confidence: 0.85,
    };
  }

  private planGenerateReport(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'resume-intelligence', action: 'full_analysis', input: entities, dependsOn: [], status: 'pending' },
        { id: 's2', order: 2, agent: 'interview-summary', action: 'compile', input: {}, dependsOn: ['s1'], status: 'pending' },
        { id: 's3', order: 3, agent: 'report-generator', action: 'generate', input: {}, dependsOn: ['s1', 's2'], status: 'pending' },
      ],
      estimatedDuration_ms: 20000,
      requiresHumanApproval: false,
      confidence: 0.8,
    };
  }

  private planCompareCandidates(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'resume-intelligence', action: 'batch_score', input: entities, dependsOn: [], status: 'pending' },
        { id: 's2', order: 2, agent: 'comparison-agent', action: 'compare', input: {}, dependsOn: ['s1'], status: 'pending' },
      ],
      estimatedDuration_ms: 12000,
      requiresHumanApproval: false,
      confidence: 0.85,
    };
  }

  private planSuggestQuestions(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'interview-agent', action: 'generate_questions', input: entities, dependsOn: [], status: 'pending' },
      ],
      estimatedDuration_ms: 5000,
      requiresHumanApproval: false,
      confidence: 0.9,
    };
  }

  private planDraftOutreach(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'outreach-agent', action: 'draft_email', input: entities, dependsOn: [], status: 'pending' },
      ],
      estimatedDuration_ms: 5000,
      requiresHumanApproval: true,
      confidence: 0.8,
    };
  }

  private planPipelineStatus(entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'pipeline-tracker', action: 'get_status', input: entities, dependsOn: [], status: 'pending' },
      ],
      estimatedDuration_ms: 2000,
      requiresHumanApproval: false,
      confidence: 0.95,
    };
  }

  private planGeneral(intent: OperatorIntent, entities: ExtractedEntities): ExecutionPlan {
    return {
      steps: [
        { id: 's1', order: 1, agent: 'general-assistant', action: 'answer', input: { intent, entities }, dependsOn: [], status: 'pending' },
      ],
      estimatedDuration_ms: 5000,
      requiresHumanApproval: false,
      confidence: 0.7,
    };
  }

  // ─── Step Execution ────────────────────────────────────────────────────────

  private async executeStep(step: PlanStep, command: OperatorCommand): Promise<OperatorResult> {
    // In production, each agent would be a real service call.
    // Here we use LLM to simulate agent execution with structured output.
    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are the "${step.agent}" agent in a recruiting AI system.
Execute the action "${step.action}" with the given input.
Return a JSON response with:
{
  "data": { ... relevant structured data ... },
  "summary": "one-line summary of what was done",
  "confidence": 0.0-1.0
}
Be specific and data-driven. Generate realistic but clearly marked as simulated data.`,
        },
        {
          role: 'user',
          content: `Action: ${step.action}\nInput: ${JSON.stringify(step.input)}\nUser query: ${command.input}\nEntities: ${JSON.stringify(command.entities)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      metadata: { tenantId: command.tenantId, agentName: step.agent },
    });

    const parsed = JSON.parse(response.content);
    return {
      stepId: step.id,
      agent: step.agent,
      action: step.action,
      data: parsed.data || {},
      summary: parsed.summary || `${step.agent}:${step.action} completed`,
      confidence: parsed.confidence || 0.7,
    };
  }

  // ─── Memory Persistence ────────────────────────────────────────────────────

  private async persistLearnings(command: OperatorCommand, userId: string, tenantId: string): Promise<void> {
    try {
      await memory.persistLearnings(
        command.id,
        userId,
        tenantId,
        {
          facts: command.results.map(r => r.summary),
          decisions: command.plan.requiresHumanApproval ? [`Human approval required for: ${command.input}`] : [],
          observations: [`User intent: ${command.intent}, confidence: ${command.plan.confidence}`],
          agentName: 'recruiting-operator',
        }
      );
    } catch {
      // Non-blocking
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const operator = new RecruitingOperator();
