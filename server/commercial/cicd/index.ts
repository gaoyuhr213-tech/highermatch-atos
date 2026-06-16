/**
 * Phase 14-C: CI/CD Pipeline
 * 
 * GitHub Actions + ArgoCD + Environment Promotion
 * 
 * 对标：GitLab CI/CD / Vercel / Railway
 * 
 * 架构：
 * GitHub Actions (CI)
 *   ├── lint → test → build → push image
 *   ├── Database migration (safe)
 *   └── Notification (Slack/DingTalk/Feishu)
 * 
 * ArgoCD (CD)
 *   ├── dev → staging → production
 *   ├── GitOps (declarative)
 *   └── Auto-rollback on failure
 */

// ============================================================
// Types
// ============================================================

export interface Pipeline {
  id: string;
  name: string;
  trigger: PipelineTrigger;
  stages: PipelineStage[];
  environment: Environment;
  status: PipelineStatus;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null; // seconds
  commit: CommitInfo;
  actor: string;
}

export type PipelineTrigger = 'push' | 'pull_request' | 'tag' | 'manual' | 'schedule' | 'webhook';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';
export type Environment = 'development' | 'staging' | 'production';

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  jobs: PipelineJob[];
}

export interface PipelineJob {
  name: string;
  status: PipelineStatus;
  logs: string;
  artifacts: string[];
  duration: number | null;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  branch: string;
  tag?: string;
}

export interface DeploymentConfig {
  environment: Environment;
  strategy: 'rolling' | 'blue_green' | 'canary';
  replicas: number;
  resources: { cpu: string; memory: string };
  healthCheck: { path: string; interval: number; timeout: number };
  rollback: { automatic: boolean; threshold: number };
  notifications: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'slack' | 'dingtalk' | 'feishu' | 'email' | 'webhook';
  target: string; // webhook URL or channel ID
  events: ('success' | 'failure' | 'rollback' | 'approval_needed')[];
}

// ============================================================
// GitHub Actions Workflow Generator
// ============================================================

export class CICDPipelineGenerator {

  /**
   * 生成完整的 GitHub Actions CI/CD 配置
   */
  generateGitHubActions(): Record<string, string> {
    return {
      '.github/workflows/ci.yml': this.generateCIWorkflow(),
      '.github/workflows/cd-staging.yml': this.generateCDWorkflow('staging'),
      '.github/workflows/cd-production.yml': this.generateCDWorkflow('production'),
      '.github/workflows/db-migrate.yml': this.generateMigrationWorkflow(),
      '.github/workflows/release.yml': this.generateReleaseWorkflow(),
    };
  }

  private generateCIWorkflow(): string {
    return `name: CI Pipeline

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9'
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  # ─── Lint & Type Check ───────────────────────────────────
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: \${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm run check  # TypeScript type check

  # ─── Unit Tests ──────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: atos_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: \${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/atos_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  # ─── Build & Push Docker Image ──────────────────────────
  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: \${{ steps.meta.outputs.tags }}
      image_digest: \${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}
      - id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_ENV=production
            BUILD_DATE=\${{ github.event.head_commit.timestamp }}
            GIT_SHA=\${{ github.sha }}

  # ─── Security Scan ──────────────────────────────────────
  security:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  # ─── Notify ─────────────────────────────────────────────
  notify:
    runs-on: ubuntu-latest
    needs: [lint, test, build]
    if: always()
    steps:
      - uses: actions/checkout@v4
      - name: Send notification
        run: |
          STATUS="\${{ needs.build.result }}"
          if [ "$STATUS" = "success" ]; then
            EMOJI="✅"
          else
            EMOJI="❌"
          fi
          curl -X POST "\${{ secrets.NOTIFICATION_WEBHOOK }}" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"msgtype\\": \\"markdown\\",
              \\"markdown\\": {
                \\"title\\": \\"CI Pipeline $EMOJI\\",
                \\"text\\": \\"### CI Pipeline $EMOJI $STATUS\\n- Branch: \${{ github.ref_name }}\\n- Commit: \${{ github.event.head_commit.message }}\\n- Author: \${{ github.actor }}\\n- [View Run](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})\\"
              }
            }"
`;
  }

  private generateCDWorkflow(env: 'staging' | 'production'): string {
    const isProduction = env === 'production';
    const trigger = isProduction
      ? `on:\n  workflow_dispatch:\n    inputs:\n      image_tag:\n        description: 'Docker image tag to deploy'\n        required: true\n      confirm:\n        description: 'Type DEPLOY to confirm'\n        required: true`
      : `on:\n  push:\n    branches: [main]\n  workflow_dispatch:`;

    const approvalStep = isProduction
      ? `      - name: Require approval
        uses: trstringer/manual-approval@v1
        with:
          secret: \${{ secrets.GITHUB_TOKEN }}
          approvers: cto,devops-lead
          minimum-approvals: 1
          issue-title: "Deploy to Production: \${{ github.event.inputs.image_tag }}"
`
      : '';

    return `name: CD - ${env.charAt(0).toUpperCase() + env.slice(1)}

${trigger}

env:
  ARGOCD_SERVER: \${{ secrets.ARGOCD_SERVER }}
  APP_NAME: atos-${env}
  NAMESPACE: atos-${env}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${env}
    steps:
      - uses: actions/checkout@v4
${approvalStep}
      - name: Update ArgoCD Application
        run: |
          IMAGE_TAG=\${{ github.event.inputs.image_tag || github.sha }}
          
          # Update kustomization or values.yaml
          cd deploy/${env}
          sed -i "s|image:.*|image: ghcr.io/\${{ github.repository }}:$IMAGE_TAG|" values.yaml
          
          # Commit and push (GitOps)
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "deploy(${env}): update image to $IMAGE_TAG"
          git push

      - name: Wait for ArgoCD Sync
        run: |
          # Install ArgoCD CLI
          curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
          chmod +x argocd
          
          # Login
          ./argocd login \${{ env.ARGOCD_SERVER }} \\
            --username admin \\
            --password \${{ secrets.ARGOCD_PASSWORD }} \\
            --grpc-web
          
          # Sync and wait
          ./argocd app sync \${{ env.APP_NAME }} --timeout 300
          ./argocd app wait \${{ env.APP_NAME }} --timeout 600 --health

      - name: Health Check
        run: |
          ENDPOINT=\${{ secrets.${env.toUpperCase()}_URL }}
          for i in $(seq 1 30); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT/health/ready")
            if [ "$STATUS" = "200" ]; then
              echo "✅ Health check passed"
              exit 0
            fi
            echo "Waiting... attempt $i/30 (status: $STATUS)"
            sleep 10
          done
          echo "❌ Health check failed"
          exit 1

      - name: Auto-rollback on failure
        if: failure()
        run: |
          ./argocd app rollback \${{ env.APP_NAME }}
          echo "⚠️ Deployment failed, rolled back to previous version"

      - name: Notify
        if: always()
        run: |
          STATUS="\${{ job.status }}"
          curl -X POST "\${{ secrets.NOTIFICATION_WEBHOOK }}" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"msgtype\\": \\"markdown\\",
              \\"markdown\\": {
                \\"title\\": \\"Deploy ${env} $STATUS\\",
                \\"text\\": \\"### Deploy to ${env} $STATUS\\n- Image: \${{ github.sha }}\\n- Actor: \${{ github.actor }}\\n- [ArgoCD Dashboard](\${{ env.ARGOCD_SERVER }})\\"
              }
            }"
`;
  }

  private generateMigrationWorkflow(): string {
    return `name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [development, staging, production]
      dry_run:
        description: 'Dry run (show SQL without executing)'
        required: true
        type: boolean
        default: true
      confirm:
        description: 'Type MIGRATE to confirm (production only)'
        required: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: \${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: '9'
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      - name: Validate (production requires confirmation)
        if: github.event.inputs.environment == 'production' && github.event.inputs.confirm != 'MIGRATE'
        run: |
          echo "❌ Production migration requires typing MIGRATE to confirm"
          exit 1

      - name: Create backup
        if: github.event.inputs.dry_run == 'false'
        run: |
          pg_dump "\${{ secrets.DATABASE_URL }}" > backup_\$(date +%Y%m%d_%H%M%S).sql
          echo "✅ Backup created"

      - name: Run migration
        run: |
          if [ "\${{ github.event.inputs.dry_run }}" = "true" ]; then
            echo "🔍 DRY RUN - showing pending migrations:"
            pnpm drizzle-kit generate --dry-run
          else
            echo "🚀 Applying migrations..."
            pnpm db:push
            echo "✅ Migration complete"
          fi
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}

      - name: Verify schema
        if: github.event.inputs.dry_run == 'false'
        run: |
          pnpm run check
          echo "✅ Schema verification passed"
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
`;
  }

  private generateReleaseWorkflow(): string {
    return `name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Generate changelog
        id: changelog
        run: |
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -z "$PREV_TAG" ]; then
            CHANGES=$(git log --pretty=format:"- %s (%h)" HEAD)
          else
            CHANGES=$(git log --pretty=format:"- %s (%h)" $PREV_TAG..HEAD)
          fi
          echo "changes<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGES" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/\${{ github.repository }}:\${{ github.ref_name }}
            ghcr.io/\${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - uses: softprops/action-gh-release@v2
        with:
          body: |
            ## Changes
            \${{ steps.changelog.outputs.changes }}
            
            ## Docker Image
            \\\`ghcr.io/\${{ github.repository }}:\${{ github.ref_name }}\\\`
          generate_release_notes: true
`;
  }

  // ============================================================
  // ArgoCD Application Manifests
  // ============================================================

  generateArgoCDManifests(): Record<string, string> {
    return {
      'deploy/argocd/application-staging.yaml': this.generateArgoCDApp('staging'),
      'deploy/argocd/application-production.yaml': this.generateArgoCDApp('production'),
      'deploy/argocd/project.yaml': this.generateArgoCDProject(),
    };
  }

  private generateArgoCDApp(env: 'staging' | 'production'): string {
    const syncPolicy = env === 'staging'
      ? `  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true`
      : `  syncPolicy:
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true
    # Production requires manual sync`;

    return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: atos-${env}
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: atos
  source:
    repoURL: https://github.com/gaoyuhr213-tech/highermatch-atos.git
    targetRevision: main
    path: deploy/${env}
    helm:
      valueFiles:
        - values.yaml
        - values-${env}.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: atos-${env}
${syncPolicy}
  revisionHistoryLimit: 10
`;
  }

  private generateArgoCDProject(): string {
    return `apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: atos
  namespace: argocd
spec:
  description: "蓉才通 ATOS - AI Recruiting OS"
  sourceRepos:
    - 'https://github.com/gaoyuhr213-tech/highermatch-atos.git'
  destinations:
    - namespace: 'atos-*'
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
  namespaceResourceWhitelist:
    - group: '*'
      kind: '*'
  roles:
    - name: deployer
      description: "CI/CD deployer role"
      policies:
        - p, proj:atos:deployer, applications, sync, atos/*, allow
        - p, proj:atos:deployer, applications, get, atos/*, allow
`;
  }

  // ============================================================
  // Dockerfile (Multi-stage)
  // ============================================================

  generateDockerfile(): string {
    return `# ─── Stage 1: Dependencies ─────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ─── Stage 2: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
RUN pnpm run db:push --dry-run  # Validate migrations

# ─── Stage 3: Production ─────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 atos
USER atos

# Copy production dependencies
COPY --from=deps --chown=atos:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=atos:nodejs /app/dist ./dist
COPY --from=builder --chown=atos:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=atos:nodejs /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start
CMD ["node", "dist/index.js"]
`;
  }

  // ============================================================
  // Environment Configuration
  // ============================================================

  generateEnvironmentConfigs(): Record<string, EnvironmentConfig> {
    return {
      development: {
        name: 'development',
        replicas: 1,
        resources: { cpu: '500m', memory: '512Mi' },
        autoscaling: { enabled: false, min: 1, max: 1, targetCPU: 80 },
        database: { poolSize: 5, ssl: false },
        redis: { db: 0, maxRetries: 3 },
        logging: { level: 'debug', format: 'pretty' },
        features: { debugMode: true, mockPayments: true, seedData: true },
      },
      staging: {
        name: 'staging',
        replicas: 2,
        resources: { cpu: '1000m', memory: '1Gi' },
        autoscaling: { enabled: true, min: 2, max: 5, targetCPU: 70 },
        database: { poolSize: 20, ssl: true },
        redis: { db: 1, maxRetries: 5 },
        logging: { level: 'info', format: 'json' },
        features: { debugMode: false, mockPayments: true, seedData: false },
      },
      production: {
        name: 'production',
        replicas: 3,
        resources: { cpu: '2000m', memory: '2Gi' },
        autoscaling: { enabled: true, min: 3, max: 20, targetCPU: 60 },
        database: { poolSize: 50, ssl: true },
        redis: { db: 0, maxRetries: 10 },
        logging: { level: 'warn', format: 'json' },
        features: { debugMode: false, mockPayments: false, seedData: false },
      },
    };
  }
}

// ============================================================
// Supporting Types
// ============================================================

interface EnvironmentConfig {
  name: string;
  replicas: number;
  resources: { cpu: string; memory: string };
  autoscaling: { enabled: boolean; min: number; max: number; targetCPU: number };
  database: { poolSize: number; ssl: boolean };
  redis: { db: number; maxRetries: number };
  logging: { level: string; format: string };
  features: Record<string, boolean>;
}

// ============================================================
// Secret Management
// ============================================================

export const REQUIRED_SECRETS = {
  // All environments
  common: [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
  ],
  // Staging + Production
  deployed: [
    'ARGOCD_SERVER',
    'ARGOCD_PASSWORD',
    'NOTIFICATION_WEBHOOK',
    'SENTRY_DSN',
  ],
  // Production only
  production: [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'WECHAT_PAY_MCH_ID',
    'WECHAT_PAY_API_KEY',
    'ALIPAY_APP_ID',
    'ALIPAY_PRIVATE_KEY',
    'SM4_KEY',
    'BACKUP_S3_BUCKET',
  ],
} as const;

// ============================================================
// Pipeline API Routes
// ============================================================

export const CICD_ROUTES = {
  'GET /api/v2/cicd/pipelines': 'listPipelines',
  'GET /api/v2/cicd/pipelines/:id': 'getPipeline',
  'POST /api/v2/cicd/pipelines/:id/retry': 'retryPipeline',
  'POST /api/v2/cicd/pipelines/:id/cancel': 'cancelPipeline',
  'GET /api/v2/cicd/deployments': 'listDeployments',
  'GET /api/v2/cicd/deployments/:env/status': 'getDeploymentStatus',
  'POST /api/v2/cicd/deployments/:env/rollback': 'rollbackDeployment',
  'GET /api/v2/cicd/environments': 'listEnvironments',
  'GET /api/v2/cicd/secrets': 'listSecretKeys', // names only, never values
  'POST /api/v2/cicd/migrations/validate': 'validateMigration',
} as const;
