/**
 * Phase 14-B: Payment Integration
 * 
 * 统一支付网关：Stripe + 微信支付 + 支付宝
 * 
 * 对标：Stripe Billing / Paddle / LemonSqueezy
 * 
 * 架构：
 * PaymentGateway (抽象层)
 *   ├── StripeProvider
 *   ├── WechatPayProvider
 *   └── AlipayProvider
 * 
 * SubscriptionManager
 *   ├── Plan Management
 *   ├── Upgrade/Downgrade
 *   ├── Usage Metering
 *   └── Invoice Generation
 */

// ============================================================
// Types
// ============================================================

export type PaymentProvider = 'stripe' | 'wechat_pay' | 'alipay';
export type Currency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'unpaid';

export interface PaymentMethod {
  id: string;
  tenantId: string;
  provider: PaymentProvider;
  type: 'card' | 'wechat' | 'alipay' | 'bank_transfer' | 'invoice';
  details: {
    brand?: string;       // visa, mastercard, unionpay
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    holderName?: string;
    bankName?: string;
  };
  isDefault: boolean;
  createdAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';
  pricing: {
    monthly: { amount: number; currency: Currency };
    annual: { amount: number; currency: Currency; discount: number };
  };
  features: PlanFeature[];
  limits: PlanLimits;
  trialDays: number;
  popular: boolean;
}

export interface PlanFeature {
  key: string;
  name: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  seats: number;
  aiTokensPerMonth: number;
  storageMB: number;
  apiCallsPerMonth: number;
  interviewsPerMonth: number;
  workflowsPerMonth: number;
  customModels: boolean;
  sso: boolean;
  dedicatedSupport: boolean;
  sla: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  quantity: number; // seats
  addons: SubscriptionAddon[];
  paymentMethodId: string;
  provider: PaymentProvider;
  externalId: string; // Stripe sub_xxx / WeChat order_xxx
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionAddon {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  number: string; // INV-2026-001234
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  type: 'subscription' | 'usage' | 'one_time';
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: Currency;
  dueDate: Date;
  paidAt: Date | null;
  invoiceUrl: string;
  pdfUrl: string;
  // 中国增值税发票
  vatInvoice?: {
    type: 'special' | 'general'; // 专票/普票
    taxId: string;
    companyName: string;
    address: string;
    phone: string;
    bankName: string;
    bankAccount: string;
  };
  createdAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  period?: { start: Date; end: Date };
  metadata?: Record<string, string>;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  metric: UsageMetric;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export type UsageMetric = 
  | 'ai_tokens'
  | 'api_calls'
  | 'storage_mb'
  | 'interviews'
  | 'resumes_parsed'
  | 'people_searches'
  | 'workflow_runs';

// ============================================================
// Payment Gateway (Abstract Layer)
// ============================================================

export interface IPaymentProvider {
  name: PaymentProvider;
  
  // Payment
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent>;
  confirmPayment(intentId: string): Promise<PaymentResult>;
  cancelPayment(intentId: string): Promise<void>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  
  // Subscription
  createSubscription(params: CreateSubscriptionParams): Promise<ExternalSubscription>;
  updateSubscription(subId: string, params: UpdateSubscriptionParams): Promise<ExternalSubscription>;
  cancelSubscription(subId: string, atPeriodEnd: boolean): Promise<void>;
  
  // Webhook
  verifyWebhook(payload: string, signature: string): boolean;
  handleWebhook(event: WebhookEvent): Promise<void>;
}

interface CreatePaymentParams {
  amount: number;
  currency: Currency;
  description: string;
  metadata: Record<string, string>;
  returnUrl?: string;
  notifyUrl?: string;
}

interface PaymentIntent {
  id: string;
  clientSecret?: string;   // Stripe
  qrCodeUrl?: string;      // WeChat
  payUrl?: string;         // Alipay
  status: string;
}

interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: Currency;
  paidAt: Date;
}

interface RefundResult {
  id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
}

interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  quantity: number;
  trialDays?: number;
  metadata: Record<string, string>;
}

interface UpdateSubscriptionParams {
  priceId?: string;
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
}

interface ExternalSubscription {
  id: string;
  status: string;
  currentPeriodEnd: Date;
}

interface WebhookEvent {
  type: string;
  data: unknown;
}

// ============================================================
// Stripe Provider
// ============================================================

export class StripeProvider implements IPaymentProvider {
  name: PaymentProvider = 'stripe';
  
  constructor(private config: { secretKey: string; webhookSecret: string }) {}

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    // stripe.paymentIntents.create({
    //   amount: params.amount * 100, // cents
    //   currency: params.currency.toLowerCase(),
    //   metadata: params.metadata,
    //   automatic_payment_methods: { enabled: true },
    // })
    return { id: `pi_${Date.now()}`, clientSecret: `pi_${Date.now()}_secret_xxx`, status: 'requires_payment_method' };
  }

  async confirmPayment(intentId: string): Promise<PaymentResult> {
    return { success: true, transactionId: intentId, amount: 0, currency: 'USD', paidAt: new Date() };
  }

  async cancelPayment(intentId: string): Promise<void> {
    // stripe.paymentIntents.cancel(intentId)
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    // stripe.refunds.create({ payment_intent: paymentId, amount })
    return { id: `re_${Date.now()}`, amount: amount || 0, status: 'succeeded' };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ExternalSubscription> {
    // stripe.subscriptions.create(...)
    return { id: `sub_${Date.now()}`, status: 'active', currentPeriodEnd: new Date() };
  }

  async updateSubscription(subId: string, params: UpdateSubscriptionParams): Promise<ExternalSubscription> {
    // stripe.subscriptions.update(subId, ...)
    return { id: subId, status: 'active', currentPeriodEnd: new Date() };
  }

  async cancelSubscription(subId: string, atPeriodEnd: boolean): Promise<void> {
    // stripe.subscriptions.update(subId, { cancel_at_period_end: atPeriodEnd })
  }

  verifyWebhook(payload: string, signature: string): boolean {
    // stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret)
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    const handlers: Record<string, (data: unknown) => Promise<void>> = {
      'invoice.paid': async (data) => { /* Update subscription status */ },
      'invoice.payment_failed': async (data) => { /* Mark past_due, notify */ },
      'customer.subscription.updated': async (data) => { /* Sync subscription */ },
      'customer.subscription.deleted': async (data) => { /* Handle cancellation */ },
      'charge.dispute.created': async (data) => { /* Handle dispute */ },
      'charge.refunded': async (data) => { /* Handle refund */ },
    };
    const handler = handlers[event.type];
    if (handler) await handler(event.data);
  }
}

// ============================================================
// WeChat Pay Provider
// ============================================================

export class WechatPayProvider implements IPaymentProvider {
  name: PaymentProvider = 'wechat_pay';

  constructor(private config: {
    appId: string;
    mchId: string;
    apiKey: string;
    certPath: string;
    notifyUrl: string;
  }) {}

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    // 统一下单 API: https://api.mch.weixin.qq.com/v3/pay/transactions/native
    // Returns: code_url (QR code for Native pay)
    const orderId = `WX${Date.now()}`;
    return {
      id: orderId,
      qrCodeUrl: `weixin://wxpay/bizpayurl?pr=${orderId}`,
      status: 'pending',
    };
  }

  async confirmPayment(intentId: string): Promise<PaymentResult> {
    // Query order status: /v3/pay/transactions/out-trade-no/{out_trade_no}
    return { success: true, transactionId: intentId, amount: 0, currency: 'CNY', paidAt: new Date() };
  }

  async cancelPayment(intentId: string): Promise<void> {
    // Close order: /v3/pay/transactions/out-trade-no/{out_trade_no}/close
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    // Refund: /v3/refund/domestic/refunds
    return { id: `WXR${Date.now()}`, amount: amount || 0, status: 'pending' };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ExternalSubscription> {
    // WeChat doesn't have native subscriptions
    // Implement via recurring payment + scheduled billing
    return { id: `wxsub_${Date.now()}`, status: 'active', currentPeriodEnd: new Date() };
  }

  async updateSubscription(subId: string, params: UpdateSubscriptionParams): Promise<ExternalSubscription> {
    return { id: subId, status: 'active', currentPeriodEnd: new Date() };
  }

  async cancelSubscription(subId: string, _atPeriodEnd: boolean): Promise<void> {}

  verifyWebhook(payload: string, signature: string): boolean {
    // Verify WECHATPAY2-SHA256-RSA2048 signature
    // Headers: Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    // event_type: TRANSACTION.SUCCESS / REFUND.SUCCESS / REFUND.ABNORMAL
  }
}

// ============================================================
// Alipay Provider
// ============================================================

export class AlipayProvider implements IPaymentProvider {
  name: PaymentProvider = 'alipay';

  constructor(private config: {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    notifyUrl: string;
    returnUrl: string;
  }) {}

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    // alipay.trade.page.pay (电脑网站) / alipay.trade.wap.pay (手机网站)
    const orderId = `ALI${Date.now()}`;
    return {
      id: orderId,
      payUrl: `https://openapi.alipay.com/gateway.do?out_trade_no=${orderId}`,
      status: 'pending',
    };
  }

  async confirmPayment(intentId: string): Promise<PaymentResult> {
    // alipay.trade.query
    return { success: true, transactionId: intentId, amount: 0, currency: 'CNY', paidAt: new Date() };
  }

  async cancelPayment(intentId: string): Promise<void> {
    // alipay.trade.cancel
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    // alipay.trade.refund
    return { id: `ALIR${Date.now()}`, amount: amount || 0, status: 'succeeded' };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ExternalSubscription> {
    // alipay.trade.agreement.pay (代扣协议)
    return { id: `alisub_${Date.now()}`, status: 'active', currentPeriodEnd: new Date() };
  }

  async updateSubscription(subId: string, params: UpdateSubscriptionParams): Promise<ExternalSubscription> {
    return { id: subId, status: 'active', currentPeriodEnd: new Date() };
  }

  async cancelSubscription(subId: string, _atPeriodEnd: boolean): Promise<void> {
    // alipay.user.agreement.unsign
  }

  verifyWebhook(payload: string, signature: string): boolean {
    // RSA2 signature verification with Alipay public key
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    // trade_status: TRADE_SUCCESS / TRADE_CLOSED / TRADE_FINISHED
  }
}

// ============================================================
// Subscription Manager
// ============================================================

export class SubscriptionManager {
  private providers: Map<PaymentProvider, IPaymentProvider> = new Map();

  registerProvider(provider: IPaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  // --- Plan Management ---

  getPlans(): Plan[] {
    return [
      {
        id: 'plan_free',
        name: '免费版',
        tier: 'free',
        pricing: {
          monthly: { amount: 0, currency: 'CNY' },
          annual: { amount: 0, currency: 'CNY', discount: 0 },
        },
        features: [
          { key: 'resume_parse', name: '简历解析', included: true, limit: 50, unit: '份/月' },
          { key: 'ai_interview', name: 'AI面试', included: true, limit: 5, unit: '场/月' },
          { key: 'people_search', name: '人才搜索', included: true, limit: 20, unit: '次/月' },
          { key: 'workflow', name: '工作流', included: false },
          { key: 'api_access', name: 'API接入', included: false },
          { key: 'sso', name: 'SSO单点登录', included: false },
        ],
        limits: {
          seats: 3, aiTokensPerMonth: 100000, storageMB: 512,
          apiCallsPerMonth: 1000, interviewsPerMonth: 5, workflowsPerMonth: 0,
          customModels: false, sso: false, dedicatedSupport: false, sla: 'none',
        },
        trialDays: 0,
        popular: false,
      },
      {
        id: 'plan_starter',
        name: '基础版',
        tier: 'starter',
        pricing: {
          monthly: { amount: 999, currency: 'CNY' },
          annual: { amount: 9990, currency: 'CNY', discount: 17 },
        },
        features: [
          { key: 'resume_parse', name: '简历解析', included: true, limit: 500, unit: '份/月' },
          { key: 'ai_interview', name: 'AI面试', included: true, limit: 50, unit: '场/月' },
          { key: 'people_search', name: '人才搜索', included: true, limit: 200, unit: '次/月' },
          { key: 'workflow', name: '工作流', included: true, limit: 10, unit: '个' },
          { key: 'api_access', name: 'API接入', included: true },
          { key: 'sso', name: 'SSO单点登录', included: false },
        ],
        limits: {
          seats: 10, aiTokensPerMonth: 1000000, storageMB: 5120,
          apiCallsPerMonth: 50000, interviewsPerMonth: 50, workflowsPerMonth: 10,
          customModels: false, sso: false, dedicatedSupport: false, sla: '99.5%',
        },
        trialDays: 14,
        popular: false,
      },
      {
        id: 'plan_professional',
        name: '专业版',
        tier: 'professional',
        pricing: {
          monthly: { amount: 3999, currency: 'CNY' },
          annual: { amount: 39990, currency: 'CNY', discount: 17 },
        },
        features: [
          { key: 'resume_parse', name: '简历解析', included: true, limit: 5000, unit: '份/月' },
          { key: 'ai_interview', name: 'AI面试', included: true, limit: 500, unit: '场/月' },
          { key: 'people_search', name: '人才搜索', included: true, limit: 2000, unit: '次/月' },
          { key: 'workflow', name: '工作流', included: true, limit: 100, unit: '个' },
          { key: 'api_access', name: 'API接入', included: true },
          { key: 'sso', name: 'SSO单点登录', included: true },
          { key: 'memory', name: '长期记忆', included: true },
          { key: 'multimodal', name: '多模态面试', included: true },
        ],
        limits: {
          seats: 50, aiTokensPerMonth: 10000000, storageMB: 51200,
          apiCallsPerMonth: 500000, interviewsPerMonth: 500, workflowsPerMonth: 100,
          customModels: true, sso: true, dedicatedSupport: false, sla: '99.9%',
        },
        trialDays: 14,
        popular: true,
      },
      {
        id: 'plan_enterprise',
        name: '企业版',
        tier: 'enterprise',
        pricing: {
          monthly: { amount: 19999, currency: 'CNY' },
          annual: { amount: 199990, currency: 'CNY', discount: 17 },
        },
        features: [
          { key: 'resume_parse', name: '简历解析', included: true, limit: -1, unit: '无限' },
          { key: 'ai_interview', name: 'AI面试', included: true, limit: -1, unit: '无限' },
          { key: 'people_search', name: '人才搜索', included: true, limit: -1, unit: '无限' },
          { key: 'workflow', name: '工作流', included: true, limit: -1, unit: '无限' },
          { key: 'api_access', name: 'API接入', included: true },
          { key: 'sso', name: 'SSO单点登录', included: true },
          { key: 'memory', name: '长期记忆', included: true },
          { key: 'multimodal', name: '多模态面试', included: true },
          { key: 'private_deploy', name: '私有化部署', included: true },
          { key: 'dedicated_support', name: '专属客户成功', included: true },
          { key: 'compliance', name: '合规引擎', included: true },
          { key: 'custom_model', name: '自定义模型', included: true },
        ],
        limits: {
          seats: -1, aiTokensPerMonth: -1, storageMB: -1,
          apiCallsPerMonth: -1, interviewsPerMonth: -1, workflowsPerMonth: -1,
          customModels: true, sso: true, dedicatedSupport: true, sla: '99.99%',
        },
        trialDays: 30,
        popular: false,
      },
    ];
  }

  // --- Subscription Lifecycle ---

  async createSubscription(params: {
    tenantId: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    paymentProvider: PaymentProvider;
    paymentMethodId: string;
    seats: number;
    addons?: Array<{ id: string; quantity: number }>;
  }): Promise<Subscription> {
    const provider = this.providers.get(params.paymentProvider);
    if (!provider) throw new Error(`Provider ${params.paymentProvider} not registered`);

    // 1. Create external subscription
    const external = await provider.createSubscription({
      customerId: params.tenantId,
      priceId: params.planId,
      quantity: params.seats,
      trialDays: 14,
      metadata: { tenantId: params.tenantId },
    });

    // 2. Create internal subscription record
    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      tenantId: params.tenantId,
      planId: params.planId,
      status: 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: external.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      trialEnd: new Date(Date.now() + 14 * 86400000),
      quantity: params.seats,
      addons: [],
      paymentMethodId: params.paymentMethodId,
      provider: params.paymentProvider,
      externalId: external.id,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 3. Update tenant plan & limits
    // 4. Emit subscription.created event
    // 5. Send confirmation email

    return subscription;
  }

  async upgradePlan(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    // 1. Calculate proration
    // 2. Update external subscription
    // 3. Update internal record
    // 4. Update tenant limits immediately
    // 5. Emit subscription.upgraded event
    return {} as Subscription;
  }

  async downgradePlan(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    // 1. Schedule downgrade at period end
    // 2. Validate current usage fits new limits
    // 3. Warn if over-limit
    // 4. Emit subscription.downgrade_scheduled event
    return {} as Subscription;
  }

  async cancelSubscription(subscriptionId: string, params: {
    reason: string;
    feedback?: string;
    immediate: boolean;
  }): Promise<void> {
    // 1. Cancel external subscription
    // 2. If immediate: revoke access now
    // 3. If at period end: set cancelAtPeriodEnd = true
    // 4. Emit subscription.canceled event
    // 5. Trigger retention flow (optional)
  }

  async pauseSubscription(subscriptionId: string, resumeAt: Date): Promise<void> {
    // 1. Pause billing
    // 2. Reduce limits to free tier
    // 3. Schedule auto-resume
    // 4. Emit subscription.paused event
  }

  // --- Usage Metering ---

  async recordUsage(params: {
    tenantId: string;
    metric: UsageMetric;
    quantity: number;
    timestamp?: Date;
    idempotencyKey?: string;
  }): Promise<void> {
    // 1. Check idempotency
    // 2. Insert usage record
    // 3. Update running total
    // 4. Check quota limits
    // 5. If over limit: emit quota.exceeded event
  }

  async getUsageSummary(tenantId: string, period: { start: Date; end: Date }): Promise<UsageSummary> {
    return {
      tenantId,
      period,
      metrics: {
        ai_tokens: { used: 0, limit: 0, percentage: 0 },
        api_calls: { used: 0, limit: 0, percentage: 0 },
        storage_mb: { used: 0, limit: 0, percentage: 0 },
        interviews: { used: 0, limit: 0, percentage: 0 },
        resumes_parsed: { used: 0, limit: 0, percentage: 0 },
        people_searches: { used: 0, limit: 0, percentage: 0 },
        workflow_runs: { used: 0, limit: 0, percentage: 0 },
      },
      estimatedOverage: 0,
    };
  }

  // --- Invoice Management ---

  async generateInvoice(subscriptionId: string): Promise<Invoice> {
    // 1. Collect line items (base + usage + addons)
    // 2. Calculate tax
    // 3. Generate invoice number
    // 4. Create PDF
    // 5. Send to customer
    return {} as Invoice;
  }

  async listInvoices(tenantId: string, params: {
    status?: string;
    limit: number;
    offset: number;
  }): Promise<{ invoices: Invoice[]; total: number }> {
    return { invoices: [], total: 0 };
  }

  async requestVATInvoice(invoiceId: string, vatInfo: Invoice['vatInvoice']): Promise<void> {
    // 1. Validate tax ID
    // 2. Generate VAT invoice (增值税发票)
    // 3. Submit to tax system
    // 4. Send to customer
  }

  // --- Webhook Processing ---

  async processWebhook(provider: PaymentProvider, payload: string, signature: string): Promise<void> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) throw new Error(`Unknown provider: ${provider}`);

    if (!providerInstance.verifyWebhook(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(payload) as WebhookEvent;
    await providerInstance.handleWebhook(event);
  }
}

// ============================================================
// Supporting Types
// ============================================================

interface UsageSummary {
  tenantId: string;
  period: { start: Date; end: Date };
  metrics: Record<UsageMetric, { used: number; limit: number; percentage: number }>;
  estimatedOverage: number;
}

// ============================================================
// DB Schema
// ============================================================

export const PAYMENT_SCHEMA = `
-- Subscriptions
CREATE TABLE subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  plan_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMPTZ,
  quantity INTEGER DEFAULT 1,
  payment_method_id VARCHAR(64),
  provider VARCHAR(32) NOT NULL,
  external_id VARCHAR(128),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Methods
CREATE TABLE payment_methods (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  provider VARCHAR(32) NOT NULL,
  type VARCHAR(32) NOT NULL,
  details JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  external_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  subscription_id VARCHAR(64) REFERENCES subscriptions(id),
  number VARCHAR(32) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  type VARCHAR(32) NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  vat_invoice JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Records
CREATE TABLE usage_records (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  subscription_id VARCHAR(64) REFERENCES subscriptions(id),
  metric VARCHAR(32) NOT NULL,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key VARCHAR(128) UNIQUE,
  metadata JSONB DEFAULT '{}'
);

-- Payments
CREATE TABLE payments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
  invoice_id VARCHAR(64) REFERENCES invoices(id),
  provider VARCHAR(32) NOT NULL,
  external_id VARCHAR(128),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  refunded_amount DECIMAL(12,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_usage_records_tenant_metric ON usage_records(tenant_id, metric, timestamp);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status);
`;

// ============================================================
// API Routes
// ============================================================

export const PAYMENT_ROUTES = {
  // Plans
  'GET /api/v2/billing/plans': 'getPlans',
  
  // Subscriptions
  'GET /api/v2/billing/subscription': 'getCurrentSubscription',
  'POST /api/v2/billing/subscription': 'createSubscription',
  'POST /api/v2/billing/subscription/upgrade': 'upgradePlan',
  'POST /api/v2/billing/subscription/downgrade': 'downgradePlan',
  'POST /api/v2/billing/subscription/cancel': 'cancelSubscription',
  'POST /api/v2/billing/subscription/pause': 'pauseSubscription',
  'POST /api/v2/billing/subscription/resume': 'resumeSubscription',
  
  // Payment Methods
  'GET /api/v2/billing/payment-methods': 'listPaymentMethods',
  'POST /api/v2/billing/payment-methods': 'addPaymentMethod',
  'DELETE /api/v2/billing/payment-methods/:id': 'removePaymentMethod',
  'POST /api/v2/billing/payment-methods/:id/default': 'setDefaultPaymentMethod',
  
  // Invoices
  'GET /api/v2/billing/invoices': 'listInvoices',
  'GET /api/v2/billing/invoices/:id': 'getInvoice',
  'GET /api/v2/billing/invoices/:id/pdf': 'downloadInvoicePDF',
  'POST /api/v2/billing/invoices/:id/vat': 'requestVATInvoice',
  
  // Usage
  'GET /api/v2/billing/usage': 'getUsageSummary',
  'GET /api/v2/billing/usage/history': 'getUsageHistory',
  
  // Webhooks
  'POST /api/v2/webhooks/stripe': 'handleStripeWebhook',
  'POST /api/v2/webhooks/wechat': 'handleWechatWebhook',
  'POST /api/v2/webhooks/alipay': 'handleAlipayWebhook',
} as const;
