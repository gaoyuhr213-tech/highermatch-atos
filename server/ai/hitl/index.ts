/**
 * 蓉才通™ ATOS — Human-in-the-Loop System
 * 
 * 人工审批与接管系统：
 * - Approval Queue（审批队列）
 * - Human Override（人工覆写）
 * - Escalation Rules（升级规则）
 * - Confidence Gating（置信度门控）
 * - Audit Trail（审计追踪）
 * 
 * 支持场景：
 * - Offer Approval（Offer审批）
 * - Interview Review（面试评审）
 * - Resume Ranking Review（简历排名审核）
 * - Workflow Resume/Override（工作流恢复/覆写）
 * - High-risk Decision Gate（高风险决策门控）
 * 
 * 对标：
 * - LangGraph Human-in-the-Loop
 * - Temporal Human Tasks
 * - Airflow Manual Approval
 */

import { logger } from '../observability';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated';
export type ApprovalPriority = 'critical' | 'high' | 'medium' | 'low';
export type ApprovalCategory = 'offer' | 'interview' | 'resume_ranking' | 'workflow' | 'outreach' | 'custom';

export interface ApprovalRequest {
  id: string;
  category: ApprovalCategory;
  priority: ApprovalPriority;
  title: string;
  description: string;
  status: ApprovalStatus;
  
  // Context
  tenantId: string;
  requestedBy: string;  // agent name or user ID
  assignedTo?: string;  // reviewer user ID
  
  // Decision data
  agentDecision: AgentDecision;
  humanDecision?: HumanDecision;
  
  // Timing
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  
  // Escalation
  escalationLevel: number;
  escalationHistory: EscalationEvent[];
  
  // Workflow integration
  workflowRunId?: string;
  workflowNodeId?: string;
  resumePayload?: unknown;
  
  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface AgentDecision {
  action: string;
  confidence: number;  // 0-1
  reasoning: string;
  data: unknown;
  model: string;
  timestamp: string;
}

export interface HumanDecision {
  action: 'approve' | 'reject' | 'modify' | 'escalate';
  reviewerId: string;
  reviewerName: string;
  comment?: string;
  modifications?: unknown;
  timestamp: string;
}

export interface EscalationEvent {
  level: number;
  from: string;
  to: string;
  reason: string;
  timestamp: string;
}

export interface EscalationRule {
  category: ApprovalCategory;
  condition: EscalationCondition;
  action: EscalationAction;
}

export interface EscalationCondition {
  type: 'timeout' | 'confidence_below' | 'cost_above' | 'risk_above' | 'custom';
  threshold: number;
  timeoutMinutes?: number;
}

export interface EscalationAction {
  type: 'escalate' | 'auto_approve' | 'auto_reject' | 'notify';
  target?: string;  // role or user ID
  message?: string;
}

export interface ConfidenceGate {
  category: ApprovalCategory;
  autoApproveThreshold: number;  // above this → auto approve
  humanReviewThreshold: number;  // below this → require human
  // between the two → soft approval with notification
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIDENCE_GATES: ConfidenceGate[] = [
  { category: 'offer', autoApproveThreshold: 0.95, humanReviewThreshold: 0.7 },
  { category: 'interview', autoApproveThreshold: 0.9, humanReviewThreshold: 0.6 },
  { category: 'resume_ranking', autoApproveThreshold: 0.85, humanReviewThreshold: 0.5 },
  { category: 'workflow', autoApproveThreshold: 0.9, humanReviewThreshold: 0.65 },
  { category: 'outreach', autoApproveThreshold: 0.8, humanReviewThreshold: 0.4 },
  { category: 'custom', autoApproveThreshold: 0.9, humanReviewThreshold: 0.6 },
];

const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    category: 'offer',
    condition: { type: 'timeout', threshold: 0, timeoutMinutes: 60 },
    action: { type: 'escalate', target: 'hiring_manager', message: 'Offer approval pending > 1 hour' },
  },
  {
    category: 'offer',
    condition: { type: 'timeout', threshold: 0, timeoutMinutes: 240 },
    action: { type: 'escalate', target: 'hr_director', message: 'Offer approval pending > 4 hours' },
  },
  {
    category: 'interview',
    condition: { type: 'confidence_below', threshold: 0.3 },
    action: { type: 'escalate', target: 'senior_interviewer', message: 'Low confidence interview assessment' },
  },
  {
    category: 'resume_ranking',
    condition: { type: 'timeout', threshold: 0, timeoutMinutes: 120 },
    action: { type: 'auto_approve' },
  },
];

const DEFAULT_EXPIRY_HOURS: Record<ApprovalCategory, number> = {
  offer: 24,
  interview: 12,
  resume_ranking: 8,
  workflow: 4,
  outreach: 48,
  custom: 24,
};

// ─── HITL Engine ─────────────────────────────────────────────────────────────

export class HITLEngine {
  private queue: Map<string, ApprovalRequest> = new Map();
  private confidenceGates: ConfidenceGate[] = DEFAULT_CONFIDENCE_GATES;
  private escalationRules: EscalationRule[] = DEFAULT_ESCALATION_RULES;
  private callbacks: Map<string, (decision: HumanDecision) => void> = new Map();

  /**
   * Submit a decision for human review (or auto-approve based on confidence).
   * Returns the approval request ID. If auto-approved, resolves immediately.
   */
  async submit(params: {
    category: ApprovalCategory;
    title: string;
    description: string;
    tenantId: string;
    requestedBy: string;
    agentDecision: AgentDecision;
    priority?: ApprovalPriority;
    workflowRunId?: string;
    workflowNodeId?: string;
    resumePayload?: unknown;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<{ requestId: string; autoResolved: boolean; status: ApprovalStatus }> {
    const gate = this.getConfidenceGate(params.category);
    const confidence = params.agentDecision.confidence;

    // Auto-approve if confidence is high enough
    if (confidence >= gate.autoApproveThreshold) {
      logger.info('[HITL] Auto-approved (high confidence)', {
        category: params.category,
        confidence,
        threshold: gate.autoApproveThreshold,
      });
      return { requestId: '', autoResolved: true, status: 'approved' };
    }

    // Create approval request
    const id = `apr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const expiryHours = DEFAULT_EXPIRY_HOURS[params.category] || 24;
    const now = new Date();

    const request: ApprovalRequest = {
      id,
      category: params.category,
      priority: params.priority || this.inferPriority(confidence, params.category),
      title: params.title,
      description: params.description,
      status: 'pending',
      tenantId: params.tenantId,
      requestedBy: params.requestedBy,
      agentDecision: params.agentDecision,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiryHours * 3600000).toISOString(),
      escalationLevel: 0,
      escalationHistory: [],
      workflowRunId: params.workflowRunId,
      workflowNodeId: params.workflowNodeId,
      resumePayload: params.resumePayload,
      metadata: params.metadata || {},
      tags: params.tags || [],
    };

    this.queue.set(id, request);

    logger.info('[HITL] Approval request created', {
      id,
      category: params.category,
      confidence,
      priority: request.priority,
    });

    return { requestId: id, autoResolved: false, status: 'pending' };
  }

  /**
   * Human reviewer resolves an approval request.
   */
  resolve(requestId: string, decision: HumanDecision): ApprovalRequest | null {
    const request = this.queue.get(requestId);
    if (!request) return null;
    if (request.status !== 'pending' && request.status !== 'escalated') return null;

    request.humanDecision = decision;
    request.resolvedAt = new Date().toISOString();

    switch (decision.action) {
      case 'approve':
        request.status = 'approved';
        break;
      case 'reject':
        request.status = 'rejected';
        break;
      case 'modify':
        request.status = 'approved'; // approved with modifications
        break;
      case 'escalate':
        request.status = 'escalated';
        request.escalationLevel++;
        request.escalationHistory.push({
          level: request.escalationLevel,
          from: decision.reviewerId,
          to: decision.comment || 'next_level',
          reason: decision.comment || 'Manual escalation',
          timestamp: new Date().toISOString(),
        });
        break;
    }

    // Trigger callback if registered
    const callback = this.callbacks.get(requestId);
    if (callback && decision.action !== 'escalate') {
      callback(decision);
      this.callbacks.delete(requestId);
    }

    logger.info('[HITL] Request resolved', {
      id: requestId,
      action: decision.action,
      reviewer: decision.reviewerName,
    });

    return request;
  }

  /**
   * Register a callback for when a request is resolved.
   * Used by workflow engine to resume execution.
   */
  onResolution(requestId: string, callback: (decision: HumanDecision) => void): void {
    this.callbacks.set(requestId, callback);
  }

  /**
   * Wait for resolution (promise-based, for workflow integration).
   */
  waitForResolution(requestId: string, timeoutMs = 86400000): Promise<HumanDecision> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.callbacks.delete(requestId);
        reject(new Error(`Approval request ${requestId} timed out`));
      }, timeoutMs);

      this.onResolution(requestId, (decision) => {
        clearTimeout(timer);
        resolve(decision);
      });
    });
  }

  /**
   * Override an agent decision (human takes over).
   */
  override(requestId: string, override: {
    reviewerId: string;
    reviewerName: string;
    newDecision: unknown;
    reason: string;
  }): ApprovalRequest | null {
    const request = this.queue.get(requestId);
    if (!request) return null;

    request.humanDecision = {
      action: 'modify',
      reviewerId: override.reviewerId,
      reviewerName: override.reviewerName,
      comment: override.reason,
      modifications: override.newDecision,
      timestamp: new Date().toISOString(),
    };
    request.status = 'approved';
    request.resolvedAt = new Date().toISOString();

    logger.info('[HITL] Human override applied', {
      id: requestId,
      reviewer: override.reviewerName,
      reason: override.reason,
    });

    return request;
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  getRequest(id: string): ApprovalRequest | undefined {
    return this.queue.get(id);
  }

  getPendingRequests(tenantId: string, category?: ApprovalCategory): ApprovalRequest[] {
    return [...this.queue.values()].filter(r =>
      r.tenantId === tenantId &&
      (r.status === 'pending' || r.status === 'escalated') &&
      (!category || r.category === category)
    ).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getResolvedRequests(tenantId: string, limit = 50): ApprovalRequest[] {
    return [...this.queue.values()]
      .filter(r => r.tenantId === tenantId && (r.status === 'approved' || r.status === 'rejected'))
      .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime())
      .slice(0, limit);
  }

  getStats(tenantId: string): HITLStats {
    const requests = [...this.queue.values()].filter(r => r.tenantId === tenantId);
    const pending = requests.filter(r => r.status === 'pending' || r.status === 'escalated');
    const resolved = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
    const approved = requests.filter(r => r.status === 'approved');
    const rejected = requests.filter(r => r.status === 'rejected');

    const avgResolutionTime = resolved.length > 0
      ? resolved.reduce((sum, r) => {
          const created = new Date(r.createdAt).getTime();
          const resolvedAt = new Date(r.resolvedAt!).getTime();
          return sum + (resolvedAt - created);
        }, 0) / resolved.length
      : 0;

    return {
      totalRequests: requests.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      approvalRate: resolved.length > 0 ? approved.length / resolved.length : 0,
      avgResolutionTime_ms: avgResolutionTime,
      byCategory: this.groupByCategory(requests),
      byPriority: this.groupByPriority(pending),
    };
  }

  // ─── Escalation Check (run periodically) ──────────────────────────────────

  checkEscalations(): void {
    const now = Date.now();

    for (const request of this.queue.values()) {
      if (request.status !== 'pending') continue;

      // Check expiry
      if (now > new Date(request.expiresAt).getTime()) {
        request.status = 'expired';
        logger.warn('[HITL] Request expired', { id: request.id });
        continue;
      }

      // Check escalation rules
      for (const rule of this.escalationRules) {
        if (rule.category !== request.category) continue;

        const shouldEscalate = this.evaluateEscalationCondition(rule.condition, request, now);
        if (shouldEscalate && request.escalationLevel < 3) {
          this.applyEscalationAction(rule.action, request);
        }
      }
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private getConfidenceGate(category: ApprovalCategory): ConfidenceGate {
    return this.confidenceGates.find(g => g.category === category) || {
      category, autoApproveThreshold: 0.9, humanReviewThreshold: 0.6,
    };
  }

  private inferPriority(confidence: number, category: ApprovalCategory): ApprovalPriority {
    if (category === 'offer') return 'high';
    if (confidence < 0.3) return 'critical';
    if (confidence < 0.5) return 'high';
    if (confidence < 0.7) return 'medium';
    return 'low';
  }

  private evaluateEscalationCondition(condition: EscalationCondition, request: ApprovalRequest, now: number): boolean {
    switch (condition.type) {
      case 'timeout': {
        const elapsed = now - new Date(request.createdAt).getTime();
        return elapsed > (condition.timeoutMinutes || 60) * 60000;
      }
      case 'confidence_below':
        return request.agentDecision.confidence < condition.threshold;
      case 'cost_above':
        return false; // implement when cost data available
      case 'risk_above':
        return false; // implement when risk scoring available
      default:
        return false;
    }
  }

  private applyEscalationAction(action: EscalationAction, request: ApprovalRequest): void {
    switch (action.type) {
      case 'escalate':
        request.status = 'escalated';
        request.escalationLevel++;
        request.escalationHistory.push({
          level: request.escalationLevel,
          from: 'system',
          to: action.target || 'next_level',
          reason: action.message || 'Auto-escalation',
          timestamp: new Date().toISOString(),
        });
        logger.warn('[HITL] Auto-escalated', { id: request.id, level: request.escalationLevel });
        break;
      case 'auto_approve':
        request.status = 'approved';
        request.resolvedAt = new Date().toISOString();
        request.humanDecision = {
          action: 'approve',
          reviewerId: 'system',
          reviewerName: 'Auto-Approval',
          comment: 'Auto-approved by escalation rule (timeout)',
          timestamp: new Date().toISOString(),
        };
        break;
      case 'auto_reject':
        request.status = 'rejected';
        request.resolvedAt = new Date().toISOString();
        break;
      case 'notify':
        logger.info('[HITL] Notification sent', { target: action.target, message: action.message });
        break;
    }
  }

  private groupByCategory(requests: ApprovalRequest[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const r of requests) {
      result[r.category] = (result[r.category] || 0) + 1;
    }
    return result;
  }

  private groupByPriority(requests: ApprovalRequest[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const r of requests) {
      result[r.priority] = (result[r.priority] || 0) + 1;
    }
    return result;
  }
}

// ─── Stats Type ──────────────────────────────────────────────────────────────

export interface HITLStats {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  avgResolutionTime_ms: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const hitl = new HITLEngine();

// Start periodic escalation check (every 5 minutes)
setInterval(() => {
  try { hitl.checkEscalations(); } catch (e) { /* silent */ }
}, 5 * 60 * 1000);
