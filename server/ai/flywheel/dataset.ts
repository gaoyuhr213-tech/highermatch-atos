/**
 * Phase 12 — Learning Flywheel: Dataset Builder + Prompt Optimizer
 * 
 * 模块四：Dataset Builder — Golden/Regression/Failure/Replay数据集自动构建
 * 模块五：Prompt Optimizer — 错误/退化/高成本/低成功率Prompt检测与自动优化
 */

import type {
  Dataset,
  DatasetEntry,
  DatasetType,
  PromptVersion,
  PromptIssue,
  PromptIssueType,
  OptimizationStrategy,
  FeedbackEntry,
  ImplicitSignal,
  OutcomeLabel,
} from './types';

// ============================================================
// 模块四：Dataset Builder
// ============================================================

export class DatasetBuilder {
  private datasets: Map<string, Dataset> = new Map();
  private entries: Map<string, DatasetEntry> = new Map();

  /**
   * 创建数据集
   */
  async createDataset(params: {
    tenantId: string;
    name: string;
    description: string;
    type: DatasetType;
    agentId: string;
    promptVersion: string;
  }): Promise<Dataset> {
    const dataset: Dataset = {
      id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      tenantId: params.tenantId,
      name: params.name,
      description: params.description,
      type: params.type,
      status: 'building',
      agentId: params.agentId,
      promptVersion: params.promptVersion,
      entryCount: 0,
      qualityScore: 0,
      coverageScore: 0,
      diversityScore: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  /**
   * 从反馈修正构建 Failure Dataset
   * 用户修正 → 自动加入失败案例集
   */
  async buildFromFeedbackCorrections(params: {
    tenantId: string;
    agentId: string;
    feedbackEntries: FeedbackEntry[];
    datasetId?: string;
  }): Promise<{ datasetId: string; entriesAdded: number }> {
    let datasetId = params.datasetId;
    
    if (!datasetId) {
      const dataset = await this.createDataset({
        tenantId: params.tenantId,
        name: `${params.agentId}-failure-${new Date().toISOString().slice(0, 10)}`,
        description: `Auto-generated failure dataset from user corrections`,
        type: 'failure',
        agentId: params.agentId,
        promptVersion: 'current',
      });
      datasetId = dataset.id;
    }

    let entriesAdded = 0;

    for (const feedback of params.feedbackEntries) {
      if (!feedback.correction) continue;

      const entry: DatasetEntry = {
        id: `dse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        datasetId,
        input: {
          traceId: feedback.traceId,
          agentId: feedback.agentId,
          context: feedback.metadata,
        },
        expectedOutput: {
          correctedAnswer: feedback.correction,
          reason: feedback.reason,
        },
        quality: 'verified', // 用户修正视为已验证
        labeledBy: feedback.userId,
        sourceType: 'feedback_correction',
        sourceId: feedback.id,
        difficulty: 'hard', // 失败案例通常是困难的
        tags: ['correction', feedback.target],
        createdAt: Date.now(),
      };

      this.entries.set(entry.id, entry);
      entriesAdded++;
    }

    // 更新数据集统计
    await this.updateDatasetStats(datasetId);
    return { datasetId, entriesAdded };
  }

  /**
   * 从高置信度自动输出构建 Golden Dataset
   * 高评分 + 正面反馈 + 标签验证 → Golden
   */
  async buildGoldenDataset(params: {
    tenantId: string;
    agentId: string;
    traces: Array<{
      traceId: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
      score: number;
      feedbackPositive: boolean;
      labelValue?: number;
    }>;
    minScore?: number;
    datasetId?: string;
  }): Promise<{ datasetId: string; entriesAdded: number }> {
    const minScore = params.minScore || 0.85;
    let datasetId = params.datasetId;

    if (!datasetId) {
      const dataset = await this.createDataset({
        tenantId: params.tenantId,
        name: `${params.agentId}-golden-${new Date().toISOString().slice(0, 10)}`,
        description: `Auto-curated golden dataset from high-confidence outputs`,
        type: 'golden',
        agentId: params.agentId,
        promptVersion: 'current',
      });
      datasetId = dataset.id;
    }

    let entriesAdded = 0;

    for (const trace of params.traces) {
      // 质量门控：评分高 + 正面反馈 + （可选）标签验证
      if (trace.score < minScore) continue;
      if (!trace.feedbackPositive) continue;
      if (trace.labelValue != null && trace.labelValue < 0.7) continue;

      // 去重检查
      const isDuplicate = Array.from(this.entries.values()).some(
        e => e.datasetId === datasetId && 
             JSON.stringify(e.input) === JSON.stringify(trace.input)
      );
      if (isDuplicate) continue;

      const entry: DatasetEntry = {
        id: `dse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        datasetId,
        input: trace.input,
        expectedOutput: trace.output,
        actualOutput: trace.output,
        quality: trace.labelValue != null ? 'verified' : 'unverified',
        sourceType: 'high_confidence_auto',
        sourceId: trace.traceId,
        difficulty: trace.score > 0.95 ? 'easy' : trace.score > 0.9 ? 'medium' : 'hard',
        tags: ['golden', 'auto-curated'],
        createdAt: Date.now(),
      };

      this.entries.set(entry.id, entry);
      entriesAdded++;
    }

    await this.updateDatasetStats(datasetId);
    return { datasetId, entriesAdded };
  }

  /**
   * 构建 Regression Dataset（Prompt变更前后对比）
   */
  async buildRegressionDataset(params: {
    tenantId: string;
    agentId: string;
    goldenDatasetId: string;
    newPromptVersion: string;
  }): Promise<{ datasetId: string; entryCount: number }> {
    const goldenEntries = Array.from(this.entries.values())
      .filter(e => e.datasetId === params.goldenDatasetId);

    const dataset = await this.createDataset({
      tenantId: params.tenantId,
      name: `${params.agentId}-regression-${params.newPromptVersion}`,
      description: `Regression test dataset for prompt version ${params.newPromptVersion}`,
      type: 'regression',
      agentId: params.agentId,
      promptVersion: params.newPromptVersion,
    });

    // 复制Golden entries作为regression基准
    for (const golden of goldenEntries) {
      const entry: DatasetEntry = {
        id: `dse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        datasetId: dataset.id,
        input: golden.input,
        expectedOutput: golden.expectedOutput,
        quality: golden.quality,
        sourceType: 'replay',
        sourceId: golden.id,
        difficulty: golden.difficulty,
        tags: ['regression', `from-golden-${params.goldenDatasetId}`],
        createdAt: Date.now(),
      };
      this.entries.set(entry.id, entry);
    }

    await this.updateDatasetStats(dataset.id);
    return { datasetId: dataset.id, entryCount: goldenEntries.length };
  }

  /**
   * 构建 Replay Dataset（从trace回放）
   */
  async buildReplayDataset(params: {
    tenantId: string;
    agentId: string;
    traceReplays: Array<{
      traceId: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
      context?: Record<string, unknown>;
    }>;
  }): Promise<{ datasetId: string; entriesAdded: number }> {
    const dataset = await this.createDataset({
      tenantId: params.tenantId,
      name: `${params.agentId}-replay-${new Date().toISOString().slice(0, 10)}`,
      description: `Replay dataset from production traces`,
      type: 'replay',
      agentId: params.agentId,
      promptVersion: 'current',
    });

    let entriesAdded = 0;
    for (const replay of params.traceReplays) {
      const entry: DatasetEntry = {
        id: `dse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        datasetId: dataset.id,
        input: replay.input,
        context: replay.context,
        expectedOutput: replay.output,
        actualOutput: replay.output,
        quality: 'unverified',
        sourceType: 'replay',
        sourceId: replay.traceId,
        tags: ['replay'],
        createdAt: Date.now(),
      };
      this.entries.set(entry.id, entry);
      entriesAdded++;
    }

    await this.updateDatasetStats(dataset.id);
    return { datasetId: dataset.id, entriesAdded };
  }

  /**
   * 数据集策展（质量评分 + 去重 + 多样性）
   */
  async curateDataset(datasetId: string): Promise<{
    qualityScore: number;
    coverageScore: number;
    diversityScore: number;
    duplicatesRemoved: number;
    lowQualityFlagged: number;
  }> {
    const entries = Array.from(this.entries.values())
      .filter(e => e.datasetId === datasetId);

    // 去重
    const seen = new Set<string>();
    let duplicatesRemoved = 0;
    for (const entry of entries) {
      const fingerprint = JSON.stringify(entry.input);
      if (seen.has(fingerprint)) {
        this.entries.delete(entry.id);
        duplicatesRemoved++;
      } else {
        seen.add(fingerprint);
      }
    }

    // 质量评分
    const remainingEntries = Array.from(this.entries.values())
      .filter(e => e.datasetId === datasetId);
    const verified = remainingEntries.filter(e => e.quality === 'verified').length;
    const qualityScore = remainingEntries.length > 0 ? verified / remainingEntries.length : 0;

    // 多样性评分（基于difficulty分布）
    const difficulties = remainingEntries.map(e => e.difficulty || 'medium');
    const difficultySet = new Set(difficulties);
    const diversityScore = difficultySet.size / 3; // 3种难度

    // 覆盖度（基于tags分布）
    const allTags = new Set<string>();
    remainingEntries.forEach(e => e.tags?.forEach(t => allTags.add(t)));
    const coverageScore = Math.min(1, allTags.size / 10); // 10个tag为满分

    // 标记低质量
    let lowQualityFlagged = 0;
    for (const entry of remainingEntries) {
      if (entry.quality === 'unverified' && !entry.expectedOutput) {
        entry.quality = 'disputed';
        lowQualityFlagged++;
      }
    }

    // 更新数据集
    const dataset = this.datasets.get(datasetId);
    if (dataset) {
      dataset.qualityScore = qualityScore;
      dataset.coverageScore = coverageScore;
      dataset.diversityScore = diversityScore;
      dataset.entryCount = remainingEntries.length;
      dataset.updatedAt = Date.now();
      dataset.status = 'ready';
    }

    return { qualityScore, coverageScore, diversityScore, duplicatesRemoved, lowQualityFlagged };
  }

  /**
   * 获取数据集条目（用于Eval）
   */
  async getDatasetEntries(datasetId: string, params?: {
    quality?: 'verified' | 'unverified' | 'disputed';
    difficulty?: 'easy' | 'medium' | 'hard';
    limit?: number;
  }): Promise<DatasetEntry[]> {
    let results = Array.from(this.entries.values())
      .filter(e => e.datasetId === datasetId);

    if (params?.quality) results = results.filter(e => e.quality === params.quality);
    if (params?.difficulty) results = results.filter(e => e.difficulty === params.difficulty);
    if (params?.limit) results = results.slice(0, params.limit);

    return results;
  }

  private async updateDatasetStats(datasetId: string): Promise<void> {
    const entries = Array.from(this.entries.values())
      .filter(e => e.datasetId === datasetId);
    const dataset = this.datasets.get(datasetId);
    if (dataset) {
      dataset.entryCount = entries.length;
      dataset.updatedAt = Date.now();
    }
  }
}

// ============================================================
// 模块五：Prompt Optimizer
// ============================================================

export class PromptOptimizer {
  private versions: Map<string, PromptVersion> = new Map();
  private issues: Map<string, PromptIssue> = new Map();

  /**
   * 注册Prompt版本
   */
  async registerVersion(params: {
    agentId: string;
    version: string;
    systemPrompt: string;
    userPromptTemplate: string;
    fewShotExamples?: Array<{ input: string; output: string }>;
    parentVersion?: string;
    changeReason: string;
    changeType: 'manual' | 'auto_optimized' | 'ab_winner' | 'rollback';
    createdBy: string;
  }): Promise<PromptVersion> {
    const pv: PromptVersion = {
      id: `pv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      agentId: params.agentId,
      version: params.version,
      systemPrompt: params.systemPrompt,
      userPromptTemplate: params.userPromptTemplate,
      fewShotExamples: params.fewShotExamples,
      metrics: {
        successRate: 0,
        avgLatency: 0,
        avgCost: 0,
        avgQuality: 0,
        feedbackScore: 0,
        hallucinationRate: 0,
      },
      parentVersion: params.parentVersion,
      changeReason: params.changeReason,
      changeType: params.changeType,
      status: 'draft',
      createdAt: Date.now(),
      createdBy: params.createdBy,
    };

    this.versions.set(pv.id, pv);
    return pv;
  }

  /**
   * 更新Prompt版本指标（从Eval + Feedback + Observability聚合）
   */
  async updateVersionMetrics(versionId: string, metrics: Partial<PromptVersion['metrics']>): Promise<void> {
    const version = this.versions.get(versionId);
    if (!version) return;
    version.metrics = { ...version.metrics, ...metrics };
  }

  /**
   * 检测Prompt问题
   * 扫描所有活跃Prompt，检测：错误/退化/高成本/低成功率/幻觉/偏见
   */
  async detectIssues(params: {
    agentId: string;
    currentMetrics: PromptVersion['metrics'];
    historicalMetrics: PromptVersion['metrics']; // 上一版本或基线
    traceIds: string[];
    feedbackIds: string[];
  }): Promise<PromptIssue[]> {
    const detectedIssues: PromptIssue[] = [];
    const current = params.currentMetrics;
    const baseline = params.historicalMetrics;

    // 1. 错误检测：成功率低于阈值
    if (current.successRate < 0.85) {
      detectedIssues.push(this.createIssue({
        agentId: params.agentId,
        issueType: 'error',
        description: `Success rate dropped to ${(current.successRate * 100).toFixed(1)}% (threshold: 85%)`,
        severity: current.successRate < 0.7 ? 'critical' : 'high',
        failureRate: 1 - current.successRate,
        traceIds: params.traceIds,
        feedbackIds: params.feedbackIds,
        suggestedStrategy: 'rewrite',
      }));
    }

    // 2. 退化检测：相比基线显著下降
    if (baseline.successRate > 0 && current.successRate < baseline.successRate - 0.1) {
      detectedIssues.push(this.createIssue({
        agentId: params.agentId,
        issueType: 'degradation',
        description: `Performance degraded: ${(current.successRate * 100).toFixed(1)}% vs baseline ${(baseline.successRate * 100).toFixed(1)}%`,
        severity: 'high',
        failureRate: baseline.successRate - current.successRate,
        traceIds: params.traceIds,
        feedbackIds: params.feedbackIds,
        suggestedStrategy: 'few_shot_update',
      }));
    }

    // 3. 高成本检测
    if (current.avgCost > baseline.avgCost * 1.5 && current.avgCost > 0.01) {
      detectedIssues.push(this.createIssue({
        agentId: params.agentId,
        issueType: 'high_cost',
        description: `Cost increased ${((current.avgCost / baseline.avgCost - 1) * 100).toFixed(0)}%: $${current.avgCost.toFixed(4)} vs baseline $${baseline.avgCost.toFixed(4)}`,
        severity: current.avgCost > baseline.avgCost * 3 ? 'high' : 'medium',
        failureRate: 0,
        traceIds: params.traceIds,
        feedbackIds: [],
        suggestedStrategy: 'simplify',
      }));
    }

    // 4. 低成功率检测（反馈维度）
    if (current.feedbackScore < 0.6) {
      detectedIssues.push(this.createIssue({
        agentId: params.agentId,
        issueType: 'low_success',
        description: `User feedback score low: ${(current.feedbackScore * 100).toFixed(1)}% (threshold: 60%)`,
        severity: current.feedbackScore < 0.4 ? 'high' : 'medium',
        failureRate: 1 - current.feedbackScore,
        traceIds: params.traceIds,
        feedbackIds: params.feedbackIds,
        suggestedStrategy: 'constraint_add',
      }));
    }

    // 5. 幻觉检测
    if (current.hallucinationRate > 0.1) {
      detectedIssues.push(this.createIssue({
        agentId: params.agentId,
        issueType: 'hallucination',
        description: `Hallucination rate: ${(current.hallucinationRate * 100).toFixed(1)}% (threshold: 10%)`,
        severity: current.hallucinationRate > 0.2 ? 'critical' : 'high',
        failureRate: current.hallucinationRate,
        traceIds: params.traceIds,
        feedbackIds: params.feedbackIds,
        suggestedStrategy: 'constraint_add',
      }));
    }

    return detectedIssues;
  }

  /**
   * 自动优化Prompt（基于Eval结果 + Feedback + Labels）
   */
  async autoOptimize(params: {
    agentId: string;
    currentVersion: PromptVersion;
    issue: PromptIssue;
    failureExamples: Array<{ input: string; expectedOutput: string; actualOutput: string }>;
    successExamples: Array<{ input: string; output: string }>;
  }): Promise<{
    suggestedPrompt: string;
    strategy: OptimizationStrategy;
    expectedImprovement: number;
    confidence: number;
  }> {
    const strategy = params.issue.suggestedStrategy;
    let suggestedPrompt = params.currentVersion.systemPrompt;
    let expectedImprovement = 0;
    let confidence = 0;

    switch (strategy) {
      case 'rewrite': {
        // 完全重写：基于成功案例提取模式
        const successPatterns = params.successExamples.slice(0, 5)
          .map(e => `Input: ${e.input}\nOutput: ${e.output}`)
          .join('\n---\n');
        
        suggestedPrompt = `${params.currentVersion.systemPrompt}\n\n` +
          `[OPTIMIZATION: Rewritten based on ${params.failureExamples.length} failure cases]\n` +
          `[KEY PATTERNS FROM SUCCESS CASES]:\n${successPatterns.slice(0, 500)}`;
        expectedImprovement = 0.15;
        confidence = 0.6;
        break;
      }

      case 'few_shot_update': {
        // 更新Few-shot示例
        const newExamples = params.successExamples.slice(0, 3);
        suggestedPrompt = params.currentVersion.systemPrompt;
        // 实际会通过LLM生成优化版本
        expectedImprovement = 0.10;
        confidence = 0.7;
        break;
      }

      case 'constraint_add': {
        // 添加约束条件（针对幻觉/低质量）
        const failurePatterns = params.failureExamples.slice(0, 3)
          .map(e => `AVOID: "${e.actualOutput.slice(0, 100)}"`)
          .join('\n');
        
        suggestedPrompt = params.currentVersion.systemPrompt + '\n\n' +
          `[CONSTRAINTS - DO NOT]:\n${failurePatterns}\n` +
          `[ALWAYS]: Verify claims against provided context. If uncertain, state "I'm not sure about this."`;
        expectedImprovement = 0.12;
        confidence = 0.65;
        break;
      }

      case 'simplify': {
        // 简化Prompt（降低成本）
        // 移除冗余指令，压缩Few-shot
        suggestedPrompt = params.currentVersion.systemPrompt
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s{2,}/g, ' ');
        expectedImprovement = 0.05;
        confidence = 0.8;
        break;
      }

      case 'decompose': {
        // 分解为多步骤（复杂任务）
        suggestedPrompt = `[DECOMPOSED APPROACH]\n` +
          `Step 1: Analyze the input\n` +
          `Step 2: Generate initial response\n` +
          `Step 3: Self-verify against constraints\n` +
          `Step 4: Refine and output\n\n` +
          params.currentVersion.systemPrompt;
        expectedImprovement = 0.08;
        confidence = 0.55;
        break;
      }
    }

    return { suggestedPrompt, strategy, expectedImprovement, confidence };
  }

  /**
   * 获取Prompt版本历史
   */
  async getVersionHistory(agentId: string): Promise<PromptVersion[]> {
    return Array.from(this.versions.values())
      .filter(v => v.agentId === agentId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 获取活跃问题
   */
  async getActiveIssues(agentId?: string): Promise<PromptIssue[]> {
    let results = Array.from(this.issues.values())
      .filter(i => i.status === 'detected' || i.status === 'confirmed');
    
    if (agentId) results = results.filter(i => i.agentId === agentId);
    
    return results.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Prompt版本对比（Diff）
   */
  async diffVersions(versionIdA: string, versionIdB: string): Promise<{
    promptDiff: { added: string[]; removed: string[]; unchanged: string[] };
    metricsDiff: Record<string, { before: number; after: number; change: number }>;
  }> {
    const vA = this.versions.get(versionIdA);
    const vB = this.versions.get(versionIdB);
    if (!vA || !vB) throw new Error('Version not found');

    // 简单行级diff
    const linesA = vA.systemPrompt.split('\n');
    const linesB = vB.systemPrompt.split('\n');
    const setA = new Set(linesA);
    const setB = new Set(linesB);

    const added = linesB.filter(l => !setA.has(l));
    const removed = linesA.filter(l => !setB.has(l));
    const unchanged = linesA.filter(l => setB.has(l));

    // 指标对比
    const metricsDiff: Record<string, { before: number; after: number; change: number }> = {};
    for (const key of Object.keys(vA.metrics) as Array<keyof PromptVersion['metrics']>) {
      metricsDiff[key] = {
        before: vA.metrics[key],
        after: vB.metrics[key],
        change: vB.metrics[key] - vA.metrics[key],
      };
    }

    return { promptDiff: { added, removed, unchanged }, metricsDiff };
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(versionId: string): Promise<PromptVersion | null> {
    const target = this.versions.get(versionId);
    if (!target) return null;

    // 废弃当前活跃版本
    const activeVersions = Array.from(this.versions.values())
      .filter(v => v.agentId === target.agentId && v.status === 'active');
    
    for (const active of activeVersions) {
      active.status = 'deprecated';
      active.deprecatedAt = Date.now();
    }

    // 创建回滚版本
    const rollback = await this.registerVersion({
      agentId: target.agentId,
      version: this.incrementVersion(target.version, 'patch'),
      systemPrompt: target.systemPrompt,
      userPromptTemplate: target.userPromptTemplate,
      fewShotExamples: target.fewShotExamples,
      parentVersion: target.version,
      changeReason: `Rollback to version ${target.version}`,
      changeType: 'rollback',
      createdBy: 'system',
    });

    rollback.status = 'active';
    rollback.deployedAt = Date.now();
    return rollback;
  }

  private createIssue(params: {
    agentId: string;
    issueType: PromptIssueType;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    failureRate: number;
    traceIds: string[];
    feedbackIds: string[];
    suggestedStrategy: OptimizationStrategy;
  }): PromptIssue {
    const issue: PromptIssue = {
      id: `pi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      agentId: params.agentId,
      promptVersion: 'current',
      issueType: params.issueType,
      description: params.description,
      severity: params.severity,
      evidenceTraceIds: params.traceIds.slice(0, 10),
      evidenceFeedbackIds: params.feedbackIds.slice(0, 10),
      sampleCount: params.traceIds.length,
      failureRate: params.failureRate,
      suggestedStrategy: params.suggestedStrategy,
      status: 'detected',
      detectedAt: Date.now(),
    };

    this.issues.set(issue.id, issue);
    return issue;
  }

  private incrementVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
    const parts = version.split('.').map(Number);
    switch (type) {
      case 'major': return `${parts[0] + 1}.0.0`;
      case 'minor': return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch': return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
  }
}

// ============================================================
// 单例导出
// ============================================================

export const datasetBuilder = new DatasetBuilder();
export const promptOptimizer = new PromptOptimizer();
