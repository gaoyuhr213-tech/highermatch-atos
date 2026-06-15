/**
 * Phase 13-A: Multi-Tenant SaaS + RBAC + Permission Engine
 * 
 * 企业级多租户体系：Tenant → Organization → Workspace → User → Role → Permission
 * 
 * 对标: Salesforce / WorkDay / Okta / Auth0 Organizations
 * 
 * 核心能力：
 * 1. Postgres Row Level Security（全表RLS）
 * 2. Redis Namespace 隔离
 * 3. S3 Bucket Prefix 隔离
 * 4. pgvector 租户隔离
 * 5. RBAC + ABAC 混合权限
 * 6. Billing & Quota
 * 7. Tenant Provisioning
 */

// ============================================================
// 数据模型
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string; // URL-safe identifier
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  billing: BillingConfig;
  quota: QuotaConfig;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export type TenantPlan = 'trial' | 'starter' | 'professional' | 'enterprise' | 'government';
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deactivated';

export interface TenantSettings {
  region: DataRegion;
  language: string;
  timezone: string;
  features: FeatureFlags;
  security: SecuritySettings;
  branding: BrandingConfig;
}

export type DataRegion = 'cn-east' | 'cn-south' | 'cn-north' | 'ap-southeast' | 'eu-west' | 'us-east';

export interface FeatureFlags {
  aiInterview: boolean;
  resumeIntelligence: boolean;
  peopleGPT: boolean;
  candidateCopilot: boolean;
  workflowEngine: boolean;
  multimodalInterview: boolean;
  operator: boolean;
  complianceEngine: boolean;
  customModels: boolean;
}

export interface SecuritySettings {
  mfaRequired: boolean;
  ssoEnabled: boolean;
  ssoProvider?: 'saml' | 'oidc' | 'cas';
  ipWhitelist?: string[];
  sessionTimeout: number; // minutes
  passwordPolicy: PasswordPolicy;
  dataEncryption: 'standard' | 'customer_managed_key';
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  maxAge: number; // days
  historyCount: number;
}

export interface BrandingConfig {
  logo?: string;
  primaryColor?: string;
  companyName?: string;
  domain?: string;
}

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  parentId?: string; // 支持多级部门
  level: number;
  path: string; // materialized path: /root/dept1/team1
  headCount: number;
  createdAt: number;
}

export interface Workspace {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  type: 'recruitment' | 'talent_pool' | 'analytics' | 'compliance';
  settings: Record<string, unknown>;
  createdAt: number;
}

export interface User {
  id: string;
  tenantId: string;
  organizationId: string;
  email: string;
  name: string;
  avatar?: string;
  roles: UserRole[];
  status: 'active' | 'invited' | 'suspended' | 'deactivated';
  lastLoginAt?: number;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export type RoleName = 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager' | 'candidate' | 'auditor' | 'viewer';

export interface UserRole {
  role: RoleName;
  scope: RoleScope;
  grantedAt: number;
  grantedBy: string;
}

export interface RoleScope {
  type: 'global' | 'organization' | 'workspace' | 'job';
  resourceId?: string; // 限定范围的资源ID
}

// ============================================================
// Permission Engine (RBAC + ABAC)
// ============================================================

export type Resource = 
  | 'tenant' | 'organization' | 'workspace' | 'user' | 'role'
  | 'job' | 'candidate' | 'interview' | 'resume' | 'offer'
  | 'workflow' | 'report' | 'audit_log' | 'billing'
  | 'ai_agent' | 'memory' | 'eval' | 'experiment'
  | 'api_key' | 'webhook' | 'settings';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'export';

/**
 * RBAC Permission Matrix
 * 定义每个角色对每种资源的允许操作
 */
const PERMISSION_MATRIX: Record<RoleName, Partial<Record<Resource, Action[]>>> = {
  admin: {
    tenant: ['read', 'update'],
    organization: ['create', 'read', 'update', 'delete'],
    workspace: ['create', 'read', 'update', 'delete'],
    user: ['create', 'read', 'update', 'delete'],
    role: ['create', 'read', 'update', 'delete'],
    job: ['create', 'read', 'update', 'delete', 'approve'],
    candidate: ['create', 'read', 'update', 'delete', 'export'],
    interview: ['create', 'read', 'update', 'delete', 'approve'],
    resume: ['create', 'read', 'update', 'delete', 'export'],
    offer: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    report: ['create', 'read', 'export'],
    audit_log: ['read', 'export'],
    billing: ['read', 'update'],
    ai_agent: ['create', 'read', 'update', 'delete', 'execute'],
    memory: ['read', 'update', 'delete'],
    eval: ['create', 'read', 'execute'],
    experiment: ['create', 'read', 'update', 'delete'],
    api_key: ['create', 'read', 'delete'],
    webhook: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
  },
  recruiter: {
    job: ['create', 'read', 'update'],
    candidate: ['create', 'read', 'update', 'export'],
    interview: ['create', 'read', 'update'],
    resume: ['create', 'read', 'update'],
    offer: ['create', 'read'],
    workflow: ['read', 'execute'],
    report: ['read'],
    ai_agent: ['read', 'execute'],
    memory: ['read'],
  },
  interviewer: {
    job: ['read'],
    candidate: ['read'],
    interview: ['read', 'update'],
    resume: ['read'],
    ai_agent: ['execute'],
  },
  hiring_manager: {
    job: ['create', 'read', 'update', 'approve'],
    candidate: ['read', 'update'],
    interview: ['read', 'approve'],
    resume: ['read'],
    offer: ['read', 'approve'],
    workflow: ['read', 'approve'],
    report: ['read', 'export'],
    ai_agent: ['read', 'execute'],
  },
  candidate: {
    job: ['read'],
    interview: ['read'],
    resume: ['create', 'read', 'update'],
    ai_agent: ['execute'], // Candidate Copilot
  },
  auditor: {
    audit_log: ['read', 'export'],
    report: ['read', 'export'],
    workflow: ['read'],
    interview: ['read'],
    candidate: ['read'],
    billing: ['read'],
  },
  viewer: {
    job: ['read'],
    candidate: ['read'],
    interview: ['read'],
    report: ['read'],
  },
};

export class PermissionEngine {
  /**
   * RBAC 权限检查
   */
  checkPermission(params: {
    user: User;
    resource: Resource;
    action: Action;
    resourceTenantId?: string;
    resourceOrgId?: string;
  }): PermissionResult {
    // 1. 租户隔离检查
    if (params.resourceTenantId && params.resourceTenantId !== params.user.tenantId) {
      return { allowed: false, reason: 'cross_tenant_access_denied' };
    }

    // 2. 遍历用户角色，检查是否有任一角色允许该操作
    for (const userRole of params.user.roles) {
      const rolePerms = PERMISSION_MATRIX[userRole.role];
      if (!rolePerms) continue;

      const resourcePerms = rolePerms[params.resource];
      if (!resourcePerms) continue;

      if (!resourcePerms.includes(params.action)) continue;

      // 3. 范围检查
      if (this.checkScope(userRole.scope, params)) {
        return { allowed: true, role: userRole.role, scope: userRole.scope };
      }
    }

    return { allowed: false, reason: 'insufficient_permissions' };
  }

  /**
   * ABAC 属性级权限检查（扩展）
   */
  checkAttributePermission(params: {
    user: User;
    resource: Resource;
    action: Action;
    attributes: Record<string, unknown>;
    policies: ABACPolicy[];
  }): PermissionResult {
    // 先检查RBAC
    const rbacResult = this.checkPermission(params);
    if (!rbacResult.allowed) return rbacResult;

    // 再检查ABAC策略
    for (const policy of params.policies) {
      if (!this.evaluatePolicy(policy, params.user, params.attributes)) {
        return { allowed: false, reason: `policy_denied: ${policy.name}` };
      }
    }

    return rbacResult;
  }

  /**
   * 获取用户所有权限（用于前端渲染）
   */
  getUserPermissions(user: User): Map<Resource, Action[]> {
    const permissions = new Map<Resource, Action[]>();

    for (const userRole of user.roles) {
      const rolePerms = PERMISSION_MATRIX[userRole.role];
      if (!rolePerms) continue;

      for (const [resource, actions] of Object.entries(rolePerms)) {
        const existing = permissions.get(resource as Resource) || [];
        const merged = [...new Set([...existing, ...(actions || [])])];
        permissions.set(resource as Resource, merged);
      }
    }

    return permissions;
  }

  private checkScope(scope: RoleScope, params: {
    resourceOrgId?: string;
  }): boolean {
    switch (scope.type) {
      case 'global': return true;
      case 'organization':
        return !params.resourceOrgId || params.resourceOrgId === scope.resourceId;
      case 'workspace':
      case 'job':
        return true; // 细粒度在查询层过滤
      default: return false;
    }
  }

  private evaluatePolicy(
    policy: ABACPolicy,
    user: User,
    attributes: Record<string, unknown>
  ): boolean {
    for (const condition of policy.conditions) {
      const value = condition.subject === 'user'
        ? this.getNestedValue(user, condition.field)
        : attributes[condition.field];

      switch (condition.operator) {
        case 'eq': if (value !== condition.value) return false; break;
        case 'neq': if (value === condition.value) return false; break;
        case 'in': if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false; break;
        case 'gt': if (typeof value !== 'number' || value <= (condition.value as number)) return false; break;
        case 'lt': if (typeof value !== 'number' || value >= (condition.value as number)) return false; break;
        case 'contains': if (typeof value !== 'string' || !value.includes(condition.value as string)) return false; break;
      }
    }
    return true;
  }

  private getNestedValue(obj: any, path: string): unknown {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }
}

export interface PermissionResult {
  allowed: boolean;
  role?: RoleName;
  scope?: RoleScope;
  reason?: string;
}

export interface ABACPolicy {
  name: string;
  description: string;
  conditions: ABACCondition[];
  effect: 'allow' | 'deny';
}

export interface ABACCondition {
  subject: 'user' | 'resource';
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

// ============================================================
// Tenant Isolation Layer
// ============================================================

export class TenantIsolation {
  /**
   * 生成 Postgres RLS Policy SQL
   */
  generateRLSPolicies(tableName: string): string[] {
    return [
      `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY tenant_isolation_select ON ${tableName} FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id'));`,
      `CREATE POLICY tenant_isolation_insert ON ${tableName} FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));`,
      `CREATE POLICY tenant_isolation_update ON ${tableName} FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id'));`,
      `CREATE POLICY tenant_isolation_delete ON ${tableName} FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id'));`,
    ];
  }

  /**
   * 设置当前请求的租户上下文（每个DB连接）
   */
  getSetTenantSQL(tenantId: string): string {
    return `SET LOCAL app.current_tenant_id = '${tenantId}';`;
  }

  /**
   * Redis Key 命名空间
   */
  redisKey(tenantId: string, ...parts: string[]): string {
    return `tenant:${tenantId}:${parts.join(':')}`;
  }

  /**
   * S3 路径前缀
   */
  s3Prefix(tenantId: string, ...parts: string[]): string {
    return `tenants/${tenantId}/${parts.join('/')}`;
  }

  /**
   * pgvector 查询过滤
   */
  vectorSearchFilter(tenantId: string): string {
    return `tenant_id = '${tenantId}'`;
  }
}

// ============================================================
// Billing & Quota
// ============================================================

export interface BillingConfig {
  plan: TenantPlan;
  billingCycle: 'monthly' | 'annual';
  seats: number;
  pricePerSeat: number;
  tokenBudget: number; // monthly LLM token budget
  storageLimitGB: number;
  apiCallsLimit: number; // monthly
  customModelSlots: number;
}

export interface QuotaConfig {
  maxUsers: number;
  maxJobs: number;
  maxCandidates: number;
  maxInterviewsPerMonth: number;
  maxAICallsPerMonth: number;
  maxStorageGB: number;
  maxAPICallsPerMonth: number;
  maxWorkflowRuns: number;
}

export interface UsageMetrics {
  tenantId: string;
  period: string; // YYYY-MM
  seats: { used: number; limit: number };
  tokens: { used: number; limit: number; cost: number };
  storage: { usedGB: number; limitGB: number };
  apiCalls: { used: number; limit: number };
  interviews: { used: number; limit: number };
  aiCalls: { used: number; limit: number };
  workflowRuns: { used: number; limit: number };
}

export class BillingEngine {
  private usage: Map<string, UsageMetrics> = new Map();

  /**
   * 检查配额
   */
  async checkQuota(tenantId: string, resource: keyof QuotaConfig, increment: number = 1): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    used: number;
  }> {
    const key = `${tenantId}:${this.getCurrentPeriod()}`;
    const metrics = this.usage.get(key);
    
    if (!metrics) {
      return { allowed: true, remaining: Infinity, limit: 0, used: 0 };
    }

    // 映射resource到usage字段
    const usageField = this.mapResourceToUsage(resource);
    if (!usageField) return { allowed: true, remaining: Infinity, limit: 0, used: 0 };

    const current = (metrics as any)[usageField];
    if (!current) return { allowed: true, remaining: Infinity, limit: 0, used: 0 };

    const newUsed = current.used + increment;
    const allowed = newUsed <= current.limit;
    
    return {
      allowed,
      remaining: Math.max(0, current.limit - current.used),
      limit: current.limit,
      used: current.used,
    };
  }

  /**
   * 记录使用量
   */
  async recordUsage(tenantId: string, resource: string, amount: number): Promise<void> {
    const key = `${tenantId}:${this.getCurrentPeriod()}`;
    let metrics = this.usage.get(key);
    
    if (!metrics) {
      metrics = this.initializeMetrics(tenantId);
      this.usage.set(key, metrics);
    }

    const usageField = this.mapResourceToUsage(resource as keyof QuotaConfig);
    if (usageField && (metrics as any)[usageField]) {
      (metrics as any)[usageField].used += amount;
    }
  }

  /**
   * 获取使用报告
   */
  async getUsageReport(tenantId: string, period?: string): Promise<UsageMetrics | null> {
    const key = `${tenantId}:${period || this.getCurrentPeriod()}`;
    return this.usage.get(key) || null;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private mapResourceToUsage(resource: keyof QuotaConfig | string): string | null {
    const mapping: Record<string, string> = {
      maxUsers: 'seats',
      maxAICallsPerMonth: 'aiCalls',
      maxAPICallsPerMonth: 'apiCalls',
      maxInterviewsPerMonth: 'interviews',
      maxStorageGB: 'storage',
      maxWorkflowRuns: 'workflowRuns',
    };
    return mapping[resource] || null;
  }

  private initializeMetrics(tenantId: string): UsageMetrics {
    return {
      tenantId,
      period: this.getCurrentPeriod(),
      seats: { used: 0, limit: 50 },
      tokens: { used: 0, limit: 10_000_000, cost: 0 },
      storage: { usedGB: 0, limitGB: 100 },
      apiCalls: { used: 0, limit: 100_000 },
      interviews: { used: 0, limit: 1000 },
      aiCalls: { used: 0, limit: 50_000 },
      workflowRuns: { used: 0, limit: 5000 },
    };
  }
}

// ============================================================
// Tenant Provisioning
// ============================================================

export class TenantProvisioning {
  private tenants: Map<string, Tenant> = new Map();
  private organizations: Map<string, Organization> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private users: Map<string, User> = new Map();

  /**
   * 创建新租户（完整初始化流程）
   */
  async provisionTenant(params: {
    name: string;
    slug: string;
    plan: TenantPlan;
    region: DataRegion;
    adminEmail: string;
    adminName: string;
  }): Promise<{ tenant: Tenant; admin: User; rootOrg: Organization }> {
    const tenantId = `tn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. 创建租户
    const tenant: Tenant = {
      id: tenantId,
      name: params.name,
      slug: params.slug,
      plan: params.plan,
      status: 'active',
      settings: {
        region: params.region,
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        features: this.getDefaultFeatures(params.plan),
        security: this.getDefaultSecurity(params.plan),
        branding: { companyName: params.name },
      },
      billing: this.getDefaultBilling(params.plan),
      quota: this.getDefaultQuota(params.plan),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
    };
    this.tenants.set(tenantId, tenant);

    // 2. 创建根组织
    const rootOrg: Organization = {
      id: `org_${tenantId}_root`,
      tenantId,
      name: params.name,
      level: 0,
      path: `/${params.slug}`,
      headCount: 0,
      createdAt: Date.now(),
    };
    this.organizations.set(rootOrg.id, rootOrg);

    // 3. 创建管理员用户
    const admin: User = {
      id: `usr_${tenantId}_admin`,
      tenantId,
      organizationId: rootOrg.id,
      email: params.adminEmail,
      name: params.adminName,
      roles: [{ role: 'admin', scope: { type: 'global' }, grantedAt: Date.now(), grantedBy: 'system' }],
      status: 'active',
      createdAt: Date.now(),
      metadata: {},
    };
    this.users.set(admin.id, admin);

    // 4. 创建默认工作空间
    const defaultWorkspace: Workspace = {
      id: `ws_${tenantId}_default`,
      tenantId,
      organizationId: rootOrg.id,
      name: '默认招聘空间',
      type: 'recruitment',
      settings: {},
      createdAt: Date.now(),
    };
    this.workspaces.set(defaultWorkspace.id, defaultWorkspace);

    return { tenant, admin, rootOrg };
  }

  /**
   * 暂停租户
   */
  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    tenant.status = 'suspended';
    tenant.metadata.suspendReason = reason;
    tenant.metadata.suspendedAt = Date.now();
  }

  /**
   * 升级计划
   */
  async upgradePlan(tenantId: string, newPlan: TenantPlan): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    tenant.plan = newPlan;
    tenant.settings.features = this.getDefaultFeatures(newPlan);
    tenant.billing = this.getDefaultBilling(newPlan);
    tenant.quota = this.getDefaultQuota(newPlan);
    tenant.updatedAt = Date.now();
    return tenant;
  }

  private getDefaultFeatures(plan: TenantPlan): FeatureFlags {
    const base: FeatureFlags = {
      aiInterview: true,
      resumeIntelligence: true,
      peopleGPT: false,
      candidateCopilot: false,
      workflowEngine: false,
      multimodalInterview: false,
      operator: false,
      complianceEngine: false,
      customModels: false,
    };

    switch (plan) {
      case 'professional':
        return { ...base, peopleGPT: true, candidateCopilot: true, workflowEngine: true };
      case 'enterprise':
        return { ...base, peopleGPT: true, candidateCopilot: true, workflowEngine: true,
          multimodalInterview: true, operator: true, complianceEngine: true };
      case 'government':
        return { ...base, peopleGPT: true, candidateCopilot: true, workflowEngine: true,
          multimodalInterview: true, operator: true, complianceEngine: true, customModels: true };
      default:
        return base;
    }
  }

  private getDefaultSecurity(plan: TenantPlan): SecuritySettings {
    return {
      mfaRequired: plan === 'government' || plan === 'enterprise',
      ssoEnabled: plan !== 'trial' && plan !== 'starter',
      sessionTimeout: plan === 'government' ? 30 : 480,
      passwordPolicy: {
        minLength: plan === 'government' ? 12 : 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: plan === 'government',
        maxAge: plan === 'government' ? 30 : 90,
        historyCount: plan === 'government' ? 12 : 5,
      },
      dataEncryption: plan === 'government' ? 'customer_managed_key' : 'standard',
    };
  }

  private getDefaultBilling(plan: TenantPlan): BillingConfig {
    const configs: Record<TenantPlan, BillingConfig> = {
      trial: { plan: 'trial', billingCycle: 'monthly', seats: 3, pricePerSeat: 0, tokenBudget: 100_000, storageLimitGB: 1, apiCallsLimit: 1000, customModelSlots: 0 },
      starter: { plan: 'starter', billingCycle: 'monthly', seats: 10, pricePerSeat: 299, tokenBudget: 1_000_000, storageLimitGB: 10, apiCallsLimit: 10_000, customModelSlots: 0 },
      professional: { plan: 'professional', billingCycle: 'annual', seats: 50, pricePerSeat: 599, tokenBudget: 10_000_000, storageLimitGB: 100, apiCallsLimit: 100_000, customModelSlots: 1 },
      enterprise: { plan: 'enterprise', billingCycle: 'annual', seats: 500, pricePerSeat: 999, tokenBudget: 100_000_000, storageLimitGB: 1000, apiCallsLimit: 1_000_000, customModelSlots: 5 },
      government: { plan: 'government', billingCycle: 'annual', seats: 1000, pricePerSeat: 1499, tokenBudget: 500_000_000, storageLimitGB: 5000, apiCallsLimit: 5_000_000, customModelSlots: 10 },
    };
    return configs[plan];
  }

  private getDefaultQuota(plan: TenantPlan): QuotaConfig {
    const configs: Record<TenantPlan, QuotaConfig> = {
      trial: { maxUsers: 3, maxJobs: 5, maxCandidates: 50, maxInterviewsPerMonth: 10, maxAICallsPerMonth: 100, maxStorageGB: 1, maxAPICallsPerMonth: 1000, maxWorkflowRuns: 10 },
      starter: { maxUsers: 10, maxJobs: 20, maxCandidates: 500, maxInterviewsPerMonth: 100, maxAICallsPerMonth: 5000, maxStorageGB: 10, maxAPICallsPerMonth: 10_000, maxWorkflowRuns: 100 },
      professional: { maxUsers: 50, maxJobs: 100, maxCandidates: 5000, maxInterviewsPerMonth: 1000, maxAICallsPerMonth: 50_000, maxStorageGB: 100, maxAPICallsPerMonth: 100_000, maxWorkflowRuns: 1000 },
      enterprise: { maxUsers: 500, maxJobs: 1000, maxCandidates: 100_000, maxInterviewsPerMonth: 10_000, maxAICallsPerMonth: 500_000, maxStorageGB: 1000, maxAPICallsPerMonth: 1_000_000, maxWorkflowRuns: 10_000 },
      government: { maxUsers: 1000, maxJobs: 5000, maxCandidates: 500_000, maxInterviewsPerMonth: 50_000, maxAICallsPerMonth: 2_000_000, maxStorageGB: 5000, maxAPICallsPerMonth: 5_000_000, maxWorkflowRuns: 50_000 },
    };
    return configs[plan];
  }
}

// ============================================================
// DB Schema（SQL DDL）
// ============================================================

/**
 * -- Tenant表
 * CREATE TABLE tenants (
 *   id TEXT PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   slug TEXT UNIQUE NOT NULL,
 *   plan TEXT NOT NULL DEFAULT 'trial',
 *   status TEXT NOT NULL DEFAULT 'pending',
 *   settings JSONB NOT NULL DEFAULT '{}',
 *   billing JSONB NOT NULL DEFAULT '{}',
 *   quota JSONB NOT NULL DEFAULT '{}',
 *   created_at BIGINT NOT NULL,
 *   updated_at BIGINT NOT NULL,
 *   metadata JSONB DEFAULT '{}'
 * );
 * 
 * -- Organization表
 * CREATE TABLE organizations (
 *   id TEXT PRIMARY KEY,
 *   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 *   name TEXT NOT NULL,
 *   parent_id TEXT REFERENCES organizations(id),
 *   level INTEGER NOT NULL DEFAULT 0,
 *   path TEXT NOT NULL,
 *   head_count INTEGER DEFAULT 0,
 *   created_at BIGINT NOT NULL
 * );
 * CREATE INDEX idx_org_tenant ON organizations(tenant_id);
 * CREATE INDEX idx_org_path ON organizations(path);
 * ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
 * 
 * -- Workspace表
 * CREATE TABLE workspaces (
 *   id TEXT PRIMARY KEY,
 *   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 *   organization_id TEXT NOT NULL REFERENCES organizations(id),
 *   name TEXT NOT NULL,
 *   type TEXT NOT NULL,
 *   settings JSONB DEFAULT '{}',
 *   created_at BIGINT NOT NULL
 * );
 * ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
 * 
 * -- Users表
 * CREATE TABLE users (
 *   id TEXT PRIMARY KEY,
 *   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 *   organization_id TEXT NOT NULL REFERENCES organizations(id),
 *   email TEXT NOT NULL,
 *   name TEXT NOT NULL,
 *   avatar TEXT,
 *   roles JSONB NOT NULL DEFAULT '[]',
 *   status TEXT NOT NULL DEFAULT 'invited',
 *   last_login_at BIGINT,
 *   created_at BIGINT NOT NULL,
 *   metadata JSONB DEFAULT '{}'
 * );
 * CREATE UNIQUE INDEX idx_user_email_tenant ON users(tenant_id, email);
 * ALTER TABLE users ENABLE ROW LEVEL SECURITY;
 * 
 * -- Usage Metrics表
 * CREATE TABLE usage_metrics (
 *   id SERIAL PRIMARY KEY,
 *   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 *   period TEXT NOT NULL,
 *   resource TEXT NOT NULL,
 *   used BIGINT NOT NULL DEFAULT 0,
 *   limit_val BIGINT NOT NULL,
 *   cost DECIMAL(10,4) DEFAULT 0,
 *   updated_at BIGINT NOT NULL
 * );
 * CREATE UNIQUE INDEX idx_usage_tenant_period_resource ON usage_metrics(tenant_id, period, resource);
 */

// ============================================================
// 单例导出
// ============================================================

export const permissionEngine = new PermissionEngine();
export const tenantIsolation = new TenantIsolation();
export const billingEngine = new BillingEngine();
export const tenantProvisioning = new TenantProvisioning();
