/**
 * Phase 13-E: Private Deployment
 * 
 * 私有化部署：Docker / K8S / Helm / Air-gap / 国产适配
 * 
 * 对标: Palantir Foundry / GitLab Self-Managed / Confluent Platform
 * 
 * 核心能力：
 * 1. Docker Compose（单机部署）
 * 2. Kubernetes Manifests
 * 3. Helm Chart
 * 4. Air-gap Deployment（离线部署）
 * 5. 国产数据库适配（达梦/人大金仓/OceanBase）
 * 6. 国产大模型适配（DeepSeek/Qwen/GLM/Baichuan）
 * 7. 国密算法（SM2/SM3/SM4）
 * 8. 多地域高可用
 * 9. 配置管理
 * 10. 升级策略
 */

// ============================================================
// 部署配置类型
// ============================================================

export type DeploymentMode = 'saas' | 'private_cloud' | 'hybrid' | 'air_gap' | 'edge';
export type DatabaseType = 'postgres' | 'dameng' | 'kingbase' | 'oceanbase' | 'gaussdb' | 'tidb';
export type LLMProvider = 'openai' | 'deepseek' | 'qwen' | 'glm' | 'baichuan' | 'minimax' | 'moonshot' | 'custom';
export type CryptoMode = 'standard' | 'gm' | 'hybrid'; // 国密模式

export interface DeploymentConfig {
  mode: DeploymentMode;
  version: string;
  region: string;
  
  // 基础设施
  infrastructure: {
    database: DatabaseConfig;
    cache: CacheConfig;
    storage: StorageConfig;
    messageQueue?: MessageQueueConfig;
  };

  // AI配置
  ai: {
    llmProvider: LLMProvider;
    llmEndpoint: string;
    llmModel: string;
    embeddingProvider: LLMProvider;
    embeddingModel: string;
    embeddingEndpoint: string;
  };

  // 安全
  security: {
    cryptoMode: CryptoMode;
    tlsVersion: '1.2' | '1.3';
    certificatePath?: string;
    gmCertPath?: string;
  };

  // 高可用
  ha: {
    enabled: boolean;
    replicas: number;
    regions: string[];
    failoverStrategy: 'active_passive' | 'active_active' | 'multi_primary';
  };

  // 资源限制
  resources: {
    cpu: string;
    memory: string;
    storage: string;
    gpuRequired: boolean;
  };
}

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
  replicaHosts?: string[];
}

export interface CacheConfig {
  type: 'redis' | 'redis_cluster' | 'redis_sentinel';
  hosts: string[];
  password?: string;
  db: number;
  maxMemory: string;
  sentinelMaster?: string;
}

export interface StorageConfig {
  type: 's3' | 'minio' | 'oss' | 'cos' | 'obs' | 'local';
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region?: string;
}

export interface MessageQueueConfig {
  type: 'redis' | 'rabbitmq' | 'kafka' | 'rocketmq';
  hosts: string[];
  username?: string;
  password?: string;
}

// ============================================================
// Docker Compose Generator
// ============================================================

export class DockerComposeGenerator {
  /**
   * 生成Docker Compose配置
   */
  generate(config: DeploymentConfig): string {
    const services: Record<string, unknown> = {};

    // ATOS主服务
    services['atos-server'] = {
      image: `highermatch/atos:${config.version}`,
      container_name: 'atos-server',
      restart: 'unless-stopped',
      ports: ['3000:3000'],
      environment: this.buildEnvVars(config),
      depends_on: ['postgres', 'redis'],
      volumes: ['./data/uploads:/app/uploads', './config:/app/config'],
      deploy: {
        resources: {
          limits: { cpus: config.resources.cpu, memory: config.resources.memory },
        },
      },
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
      },
    };

    // ATOS前端
    services['atos-web'] = {
      image: `highermatch/atos-web:${config.version}`,
      container_name: 'atos-web',
      restart: 'unless-stopped',
      ports: ['80:80', '443:443'],
      depends_on: ['atos-server'],
      volumes: ['./nginx/nginx.conf:/etc/nginx/nginx.conf', './certs:/etc/nginx/certs'],
    };

    // 数据库
    if (config.infrastructure.database.type === 'postgres') {
      services['postgres'] = {
        image: 'pgvector/pgvector:pg16',
        container_name: 'atos-postgres',
        restart: 'unless-stopped',
        ports: ['5432:5432'],
        environment: {
          POSTGRES_DB: config.infrastructure.database.database,
          POSTGRES_USER: config.infrastructure.database.username,
          POSTGRES_PASSWORD: '${POSTGRES_PASSWORD}',
        },
        volumes: ['postgres_data:/var/lib/postgresql/data', './init-db:/docker-entrypoint-initdb.d'],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}'],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      };
    }

    // Redis
    services['redis'] = {
      image: 'redis:7-alpine',
      container_name: 'atos-redis',
      restart: 'unless-stopped',
      ports: ['6379:6379'],
      command: 'redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru',
      volumes: ['redis_data:/data'],
      healthcheck: {
        test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    };

    // MinIO（对象存储）
    if (config.infrastructure.storage.type === 'minio') {
      services['minio'] = {
        image: 'minio/minio:latest',
        container_name: 'atos-minio',
        restart: 'unless-stopped',
        ports: ['9000:9000', '9001:9001'],
        command: 'server /data --console-address ":9001"',
        environment: {
          MINIO_ROOT_USER: '${MINIO_ACCESS_KEY}',
          MINIO_ROOT_PASSWORD: '${MINIO_SECRET_KEY}',
        },
        volumes: ['minio_data:/data'],
      };
    }

    const compose = {
      version: '3.8',
      services,
      volumes: {
        postgres_data: { driver: 'local' },
        redis_data: { driver: 'local' },
        minio_data: { driver: 'local' },
      },
      networks: {
        atos_network: { driver: 'bridge' },
      },
    };

    return `# 蓉才通™ ATOS - Docker Compose\n# Generated for: ${config.mode} deployment\n# Version: ${config.version}\n\n` +
      JSON.stringify(compose, null, 2);
  }

  private buildEnvVars(config: DeploymentConfig): Record<string, string> {
    return {
      NODE_ENV: 'production',
      DATABASE_URL: `postgresql://${config.infrastructure.database.username}:\${POSTGRES_PASSWORD}@postgres:5432/${config.infrastructure.database.database}`,
      REDIS_URL: 'redis://:${REDIS_PASSWORD}@redis:6379/0',
      LLM_PROVIDER: config.ai.llmProvider,
      LLM_ENDPOINT: config.ai.llmEndpoint,
      LLM_MODEL: config.ai.llmModel,
      EMBEDDING_PROVIDER: config.ai.embeddingProvider,
      EMBEDDING_MODEL: config.ai.embeddingModel,
      EMBEDDING_ENDPOINT: config.ai.embeddingEndpoint,
      STORAGE_TYPE: config.infrastructure.storage.type,
      STORAGE_ENDPOINT: config.infrastructure.storage.endpoint,
      CRYPTO_MODE: config.security.cryptoMode,
      TLS_VERSION: config.security.tlsVersion,
      HA_ENABLED: String(config.ha.enabled),
      HA_REPLICAS: String(config.ha.replicas),
    };
  }
}

// ============================================================
// Kubernetes Manifest Generator
// ============================================================

export class K8sManifestGenerator {
  /**
   * 生成完整K8S部署清单
   */
  generate(config: DeploymentConfig): K8sManifests {
    return {
      namespace: this.generateNamespace(config),
      deployment: this.generateDeployment(config),
      service: this.generateService(config),
      configMap: this.generateConfigMap(config),
      secret: this.generateSecret(config),
      hpa: this.generateHPA(config),
      pdb: this.generatePDB(config),
      ingress: this.generateIngress(config),
      networkPolicy: this.generateNetworkPolicy(config),
    };
  }

  private generateNamespace(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'atos',
        labels: { app: 'atos', version: config.version },
      },
    };
  }

  private generateDeployment(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'atos-server', namespace: 'atos' },
      spec: {
        replicas: config.ha.replicas,
        strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
        selector: { matchLabels: { app: 'atos-server' } },
        template: {
          metadata: { labels: { app: 'atos-server', version: config.version } },
          spec: {
            containers: [{
              name: 'atos-server',
              image: `highermatch/atos:${config.version}`,
              ports: [{ containerPort: 3000 }],
              resources: {
                requests: { cpu: '500m', memory: '1Gi' },
                limits: { cpu: config.resources.cpu, memory: config.resources.memory },
              },
              envFrom: [
                { configMapRef: { name: 'atos-config' } },
                { secretRef: { name: 'atos-secrets' } },
              ],
              livenessProbe: { httpGet: { path: '/health/liveness', port: 3000 }, initialDelaySeconds: 30, periodSeconds: 10 },
              readinessProbe: { httpGet: { path: '/health/readiness', port: 3000 }, initialDelaySeconds: 10, periodSeconds: 5 },
              volumeMounts: [{ name: 'config', mountPath: '/app/config' }],
            }],
            volumes: [{ name: 'config', configMap: { name: 'atos-config' } }],
            topologySpreadConstraints: [{
              maxSkew: 1,
              topologyKey: 'kubernetes.io/hostname',
              whenUnsatisfiable: 'DoNotSchedule',
              labelSelector: { matchLabels: { app: 'atos-server' } },
            }],
          },
        },
      },
    };
  }

  private generateService(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'atos-server', namespace: 'atos' },
      spec: {
        selector: { app: 'atos-server' },
        ports: [{ port: 3000, targetPort: 3000, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };
  }

  private generateConfigMap(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'atos-config', namespace: 'atos' },
      data: {
        NODE_ENV: 'production',
        LLM_PROVIDER: config.ai.llmProvider,
        LLM_MODEL: config.ai.llmModel,
        LLM_ENDPOINT: config.ai.llmEndpoint,
        EMBEDDING_PROVIDER: config.ai.embeddingProvider,
        EMBEDDING_MODEL: config.ai.embeddingModel,
        CRYPTO_MODE: config.security.cryptoMode,
        HA_ENABLED: String(config.ha.enabled),
      },
    };
  }

  private generateSecret(_config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'atos-secrets', namespace: 'atos' },
      type: 'Opaque',
      data: {
        DATABASE_URL: '# base64 encoded',
        REDIS_URL: '# base64 encoded',
        LLM_API_KEY: '# base64 encoded',
        STORAGE_ACCESS_KEY: '# base64 encoded',
        STORAGE_SECRET_KEY: '# base64 encoded',
      },
    };
  }

  private generateHPA(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: { name: 'atos-server-hpa', namespace: 'atos' },
      spec: {
        scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'atos-server' },
        minReplicas: config.ha.replicas,
        maxReplicas: config.ha.replicas * 4,
        metrics: [
          { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } },
          { type: 'Resource', resource: { name: 'memory', target: { type: 'Utilization', averageUtilization: 80 } } },
        ],
        behavior: {
          scaleUp: { stabilizationWindowSeconds: 60, policies: [{ type: 'Pods', value: 2, periodSeconds: 60 }] },
          scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: 'Pods', value: 1, periodSeconds: 120 }] },
        },
      },
    };
  }

  private generatePDB(_config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: { name: 'atos-server-pdb', namespace: 'atos' },
      spec: {
        minAvailable: 1,
        selector: { matchLabels: { app: 'atos-server' } },
      },
    };
  }

  private generateIngress(_config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'atos-ingress',
        namespace: 'atos',
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/proxy-body-size': '100m',
          'nginx.ingress.kubernetes.io/rate-limit': '100',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        },
      },
      spec: {
        tls: [{ hosts: ['atos.example.com'], secretName: 'atos-tls' }],
        rules: [{
          host: 'atos.example.com',
          http: {
            paths: [
              { path: '/api', pathType: 'Prefix', backend: { service: { name: 'atos-server', port: { number: 3000 } } } },
              { path: '/', pathType: 'Prefix', backend: { service: { name: 'atos-web', port: { number: 80 } } } },
            ],
          },
        }],
      },
    };
  }

  private generateNetworkPolicy(_config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { name: 'atos-network-policy', namespace: 'atos' },
      spec: {
        podSelector: { matchLabels: { app: 'atos-server' } },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [{ from: [{ podSelector: { matchLabels: { app: 'atos-web' } } }], ports: [{ protocol: 'TCP', port: 3000 }] }],
        egress: [
          { to: [{ podSelector: { matchLabels: { app: 'atos-postgres' } } }], ports: [{ protocol: 'TCP', port: 5432 }] },
          { to: [{ podSelector: { matchLabels: { app: 'atos-redis' } } }], ports: [{ protocol: 'TCP', port: 6379 }] },
        ],
      },
    };
  }
}

export interface K8sManifests {
  namespace: Record<string, unknown>;
  deployment: Record<string, unknown>;
  service: Record<string, unknown>;
  configMap: Record<string, unknown>;
  secret: Record<string, unknown>;
  hpa: Record<string, unknown>;
  pdb: Record<string, unknown>;
  ingress: Record<string, unknown>;
  networkPolicy: Record<string, unknown>;
}

// ============================================================
// Helm Chart Generator
// ============================================================

export class HelmChartGenerator {
  /**
   * 生成Helm Chart values.yaml
   */
  generateValues(config: DeploymentConfig): Record<string, unknown> {
    return {
      global: {
        imageRegistry: 'registry.highermatch.com',
        imagePullSecrets: ['atos-registry-secret'],
        storageClass: 'standard',
      },
      server: {
        replicaCount: config.ha.replicas,
        image: { repository: 'highermatch/atos', tag: config.version, pullPolicy: 'IfNotPresent' },
        resources: {
          requests: { cpu: '500m', memory: '1Gi' },
          limits: { cpu: config.resources.cpu, memory: config.resources.memory },
        },
        autoscaling: { enabled: true, minReplicas: config.ha.replicas, maxReplicas: config.ha.replicas * 4, targetCPU: 70 },
        env: {
          LLM_PROVIDER: config.ai.llmProvider,
          LLM_MODEL: config.ai.llmModel,
          CRYPTO_MODE: config.security.cryptoMode,
        },
      },
      web: {
        replicaCount: 2,
        image: { repository: 'highermatch/atos-web', tag: config.version },
      },
      postgresql: {
        enabled: config.infrastructure.database.type === 'postgres',
        auth: { database: config.infrastructure.database.database, username: config.infrastructure.database.username },
        primary: { persistence: { size: '100Gi' } },
        readReplicas: { replicaCount: config.ha.enabled ? 2 : 0 },
        image: { repository: 'pgvector/pgvector', tag: 'pg16' },
      },
      redis: {
        enabled: true,
        architecture: config.infrastructure.cache.type === 'redis_cluster' ? 'replication' : 'standalone',
        auth: { enabled: true },
        master: { persistence: { size: '10Gi' } },
      },
      minio: {
        enabled: config.infrastructure.storage.type === 'minio',
        mode: 'standalone',
        persistence: { size: '50Gi' },
      },
      ingress: {
        enabled: true,
        className: 'nginx',
        annotations: { 'cert-manager.io/cluster-issuer': 'letsencrypt-prod' },
        hosts: [{ host: 'atos.example.com', paths: [{ path: '/', pathType: 'Prefix' }] }],
        tls: [{ secretName: 'atos-tls', hosts: ['atos.example.com'] }],
      },
      monitoring: {
        enabled: true,
        serviceMonitor: { enabled: true },
        grafanaDashboard: { enabled: true },
      },
      backup: {
        enabled: true,
        schedule: '0 2 * * *',
        retention: '30d',
        storageClass: 'standard',
      },
    };
  }

  /**
   * 生成Chart.yaml
   */
  generateChartYaml(config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'v2',
      name: 'atos',
      description: '蓉才通™ ATOS - AI Talent Operating System',
      type: 'application',
      version: '1.0.0',
      appVersion: config.version,
      keywords: ['ai', 'recruiting', 'hr', 'talent', 'interview'],
      home: 'https://highermatch.com',
      maintainers: [{ name: 'HigherMatch', email: 'devops@highermatch.com' }],
      dependencies: [
        { name: 'postgresql', version: '15.x.x', repository: 'https://charts.bitnami.com/bitnami', condition: 'postgresql.enabled' },
        { name: 'redis', version: '19.x.x', repository: 'https://charts.bitnami.com/bitnami', condition: 'redis.enabled' },
        { name: 'minio', version: '14.x.x', repository: 'https://charts.bitnami.com/bitnami', condition: 'minio.enabled' },
      ],
    };
  }
}

// ============================================================
// Air-gap Deployment（离线部署）
// ============================================================

export interface AirGapPackage {
  version: string;
  images: AirGapImage[];
  charts: string[];
  configs: Record<string, string>;
  scripts: Record<string, string>;
  checksum: string;
  size: string;
  createdAt: number;
}

export interface AirGapImage {
  name: string;
  tag: string;
  size: string;
  digest: string;
}

export class AirGapDeployer {
  /**
   * 生成离线安装包清单
   */
  generatePackageManifest(config: DeploymentConfig): AirGapPackage {
    const images: AirGapImage[] = [
      { name: 'highermatch/atos', tag: config.version, size: '1.2GB', digest: 'sha256:...' },
      { name: 'highermatch/atos-web', tag: config.version, size: '200MB', digest: 'sha256:...' },
      { name: 'pgvector/pgvector', tag: 'pg16', size: '400MB', digest: 'sha256:...' },
      { name: 'redis', tag: '7-alpine', size: '30MB', digest: 'sha256:...' },
      { name: 'minio/minio', tag: 'latest', size: '150MB', digest: 'sha256:...' },
      { name: 'nginx', tag: 'alpine', size: '25MB', digest: 'sha256:...' },
    ];

    return {
      version: config.version,
      images,
      charts: ['atos-1.0.0.tgz'],
      configs: {
        'values.yaml': '# Helm values for air-gap deployment',
        'docker-compose.yml': '# Docker Compose for single-node',
        '.env.example': '# Environment variables template',
      },
      scripts: {
        'install.sh': this.generateInstallScript(config),
        'load-images.sh': this.generateImageLoadScript(images),
        'health-check.sh': this.generateHealthCheckScript(),
        'backup.sh': this.generateBackupScript(),
        'upgrade.sh': this.generateUpgradeScript(config),
      },
      checksum: 'sha256:...',
      size: '2.5GB',
      createdAt: Date.now(),
    };
  }

  private generateInstallScript(config: DeploymentConfig): string {
    return `#!/bin/bash
# 蓉才通™ ATOS - 离线安装脚本
# Version: ${config.version}

set -euo pipefail

echo "=== 蓉才通™ ATOS 离线安装 ==="
echo "版本: ${config.version}"
echo "部署模式: ${config.mode}"

# 1. 检查系统要求
check_requirements() {
  echo "[1/6] 检查系统要求..."
  command -v docker >/dev/null 2>&1 || { echo "需要安装Docker"; exit 1; }
  command -v docker-compose >/dev/null 2>&1 || { echo "需要安装Docker Compose"; exit 1; }
  
  # 检查最低资源
  local mem_total=$(free -g | awk '/^Mem:/{print $2}')
  if [ "$mem_total" -lt 8 ]; then
    echo "警告: 建议至少8GB内存，当前: \${mem_total}GB"
  fi
}

# 2. 加载Docker镜像
load_images() {
  echo "[2/6] 加载Docker镜像..."
  bash ./load-images.sh
}

# 3. 初始化配置
init_config() {
  echo "[3/6] 初始化配置..."
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件配置数据库密码和API密钥"
  fi
}

# 4. 启动服务
start_services() {
  echo "[4/6] 启动服务..."
  docker-compose up -d
}

# 5. 等待就绪
wait_ready() {
  echo "[5/6] 等待服务就绪..."
  local max_wait=120
  local waited=0
  while [ $waited -lt $max_wait ]; do
    if curl -sf http://localhost:3000/health/readiness > /dev/null 2>&1; then
      echo "服务已就绪!"
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
    echo "  等待中... (\${waited}s/\${max_wait}s)"
  done
  echo "超时: 服务未能在\${max_wait}秒内就绪"
  exit 1
}

# 6. 初始化数据库
init_database() {
  echo "[6/6] 初始化数据库..."
  docker-compose exec atos-server node dist/scripts/migrate.js
  docker-compose exec atos-server node dist/scripts/seed.js
}

# 执行安装
check_requirements
load_images
init_config
start_services
wait_ready
init_database

echo ""
echo "=== 安装完成 ==="
echo "访问地址: http://localhost"
echo "管理后台: http://localhost/admin"
echo "API文档:  http://localhost/api/docs"
`;
  }

  private generateImageLoadScript(images: AirGapImage[]): string {
    const loadCommands = images.map(img => 
      `echo "  加载 ${img.name}:${img.tag} (${img.size})..."\n  docker load -i images/${img.name.replace('/', '_')}_${img.tag}.tar`
    ).join('\n');

    return `#!/bin/bash
# 加载离线Docker镜像
set -euo pipefail
echo "加载Docker镜像..."
${loadCommands}
echo "镜像加载完成"
`;
  }

  private generateHealthCheckScript(): string {
    return `#!/bin/bash
# 健康检查脚本
echo "=== ATOS 健康检查 ==="
echo ""

# API服务
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo "[✓] API Server: 正常"
else
  echo "[✗] API Server: 异常"
fi

# 数据库
if docker-compose exec -T postgres pg_isready > /dev/null 2>&1; then
  echo "[✓] PostgreSQL: 正常"
else
  echo "[✗] PostgreSQL: 异常"
fi

# Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo "[✓] Redis: 正常"
else
  echo "[✗] Redis: 异常"
fi

# 存储
if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
  echo "[✓] MinIO: 正常"
else
  echo "[✗] MinIO: 异常"
fi
`;
  }

  private generateBackupScript(): string {
    return `#!/bin/bash
# 数据备份脚本
set -euo pipefail

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=== ATOS 数据备份 ==="
echo "备份目录: $BACKUP_DIR"

# 1. 数据库备份
echo "[1/3] 备份数据库..."
docker-compose exec -T postgres pg_dump -U atos atos_db | gzip > "$BACKUP_DIR/database.sql.gz"

# 2. Redis备份
echo "[2/3] 备份Redis..."
docker-compose exec -T redis redis-cli BGSAVE
sleep 2
docker cp atos-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# 3. 文件存储备份
echo "[3/3] 备份文件存储..."
docker cp atos-minio:/data "$BACKUP_DIR/storage"

echo ""
echo "=== 备份完成 ==="
echo "大小: $(du -sh $BACKUP_DIR | cut -f1)"
`;
  }

  private generateUpgradeScript(config: DeploymentConfig): string {
    return `#!/bin/bash
# 升级脚本
set -euo pipefail

NEW_VERSION="${config.version}"
echo "=== ATOS 升级到 v$NEW_VERSION ==="

# 1. 备份
echo "[1/5] 创建升级前备份..."
bash ./backup.sh

# 2. 加载新镜像
echo "[2/5] 加载新版本镜像..."
bash ./load-images.sh

# 3. 数据库迁移
echo "[3/5] 执行数据库迁移..."
docker-compose exec atos-server node dist/scripts/migrate.js

# 4. 滚动更新
echo "[4/5] 滚动更新服务..."
docker-compose up -d --no-deps atos-server
sleep 10
docker-compose up -d --no-deps atos-web

# 5. 验证
echo "[5/5] 验证升级..."
bash ./health-check.sh

echo ""
echo "=== 升级完成: v$NEW_VERSION ==="
`;
  }
}

// ============================================================
// 国产适配层
// ============================================================

export interface DomesticAdapterConfig {
  database: DatabaseType;
  llm: LLMProvider;
  crypto: CryptoMode;
  storage: 'oss' | 'cos' | 'obs' | 'minio';
}

export class DomesticAdapter {
  /**
   * 生成国产数据库适配SQL
   */
  generateDatabaseAdapter(dbType: DatabaseType): DatabaseAdapterInfo {
    const adapters: Record<DatabaseType, DatabaseAdapterInfo> = {
      postgres: {
        type: 'postgres',
        dialectPackage: 'pg',
        connectionString: 'postgresql://user:pass@host:5432/db',
        vectorSupport: true,
        vectorExtension: 'pgvector',
        notes: '原生支持，无需适配',
      },
      dameng: {
        type: 'dameng',
        dialectPackage: 'dmdb',
        connectionString: 'dm://user:pass@host:5236/db',
        vectorSupport: false,
        vectorExtension: null,
        notes: '需要外挂向量搜索（Milvus/Weaviate），或使用达梦8的JSON字段存储embedding',
        sqlDialectDiff: [
          'LIMIT → ROWNUM / FETCH FIRST',
          'SERIAL → IDENTITY',
          'JSONB → CLOB + JSON函数',
          'TEXT → CLOB',
          'BOOLEAN → NUMBER(1)',
        ],
      },
      kingbase: {
        type: 'kingbase',
        dialectPackage: 'kingbase-es',
        connectionString: 'kingbase://user:pass@host:54321/db',
        vectorSupport: true,
        vectorExtension: 'kdb_vector',
        notes: '人大金仓V8R6+支持向量扩展',
      },
      oceanbase: {
        type: 'oceanbase',
        dialectPackage: 'mysql2',
        connectionString: 'mysql://user:pass@host:2881/db',
        vectorSupport: true,
        vectorExtension: 'native',
        notes: 'OceanBase 4.x原生支持向量索引',
      },
      gaussdb: {
        type: 'gaussdb',
        dialectPackage: 'pg',
        connectionString: 'postgresql://user:pass@host:5432/db',
        vectorSupport: true,
        vectorExtension: 'pgvector',
        notes: '华为GaussDB兼容PostgreSQL协议',
      },
      tidb: {
        type: 'tidb',
        dialectPackage: 'mysql2',
        connectionString: 'mysql://user:pass@host:4000/db',
        vectorSupport: true,
        vectorExtension: 'native',
        notes: 'TiDB 7.x支持向量搜索',
      },
    };

    return adapters[dbType];
  }

  /**
   * 生成国产大模型适配配置
   */
  generateLLMAdapter(provider: LLMProvider): LLMAdapterInfo {
    const adapters: Record<LLMProvider, LLMAdapterInfo> = {
      openai: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        models: { chat: 'gpt-4o', embedding: 'text-embedding-3-large' },
        apiFormat: 'openai',
        notes: '标准OpenAI格式',
      },
      deepseek: {
        provider: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1',
        models: { chat: 'deepseek-chat', embedding: 'deepseek-embedding' },
        apiFormat: 'openai',
        notes: '兼容OpenAI格式，直接替换endpoint和model即可',
      },
      qwen: {
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: { chat: 'qwen-max', embedding: 'text-embedding-v3' },
        apiFormat: 'openai',
        notes: '通义千问兼容模式，支持OpenAI格式',
      },
      glm: {
        provider: 'glm',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        models: { chat: 'glm-4-plus', embedding: 'embedding-3' },
        apiFormat: 'openai',
        notes: '智谱GLM兼容OpenAI格式',
      },
      baichuan: {
        provider: 'baichuan',
        endpoint: 'https://api.baichuan-ai.com/v1',
        models: { chat: 'Baichuan4', embedding: 'Baichuan-Text-Embedding' },
        apiFormat: 'openai',
        notes: '百川兼容OpenAI格式',
      },
      minimax: {
        provider: 'minimax',
        endpoint: 'https://api.minimax.chat/v1',
        models: { chat: 'abab6.5s-chat', embedding: 'embo-01' },
        apiFormat: 'openai',
        notes: 'MiniMax兼容OpenAI格式',
      },
      moonshot: {
        provider: 'moonshot',
        endpoint: 'https://api.moonshot.cn/v1',
        models: { chat: 'moonshot-v1-128k', embedding: 'moonshot-v1-embedding' },
        apiFormat: 'openai',
        notes: 'Kimi/Moonshot兼容OpenAI格式',
      },
      custom: {
        provider: 'custom',
        endpoint: 'http://localhost:8000/v1',
        models: { chat: 'custom-model', embedding: 'custom-embedding' },
        apiFormat: 'openai',
        notes: '自部署模型（vLLM/Ollama/TGI），需兼容OpenAI格式',
      },
    };

    return adapters[provider];
  }

  /**
   * 生成国密算法适配配置
   */
  generateGMConfig(): GMCryptoConfig {
    return {
      algorithms: {
        asymmetric: { name: 'SM2', keySize: 256, usage: '数字签名 + 密钥交换' },
        hash: { name: 'SM3', outputSize: 256, usage: '消息摘要 + HMAC' },
        symmetric: { name: 'SM4', blockSize: 128, keySize: 128, usage: '数据加密' },
      },
      tls: {
        protocol: 'GMTLS 1.1',
        cipherSuites: ['ECC_SM4_GCM_SM3', 'ECC_SM4_CBC_SM3', 'ECDHE_SM4_GCM_SM3'],
        certificateType: 'SM2',
      },
      compliance: {
        standard: 'GB/T 35276-2017',
        certificationBody: '国家密码管理局',
        level: '商用密码产品',
      },
      implementation: {
        library: 'gm-crypto / @sinochain/sm-crypto',
        fallback: 'OpenSSL 3.x with SM2/SM3/SM4 engine',
        notes: '所有密码学操作（签名、加密、哈希）替换为国密算法',
      },
    };
  }
}

export interface DatabaseAdapterInfo {
  type: DatabaseType;
  dialectPackage: string;
  connectionString: string;
  vectorSupport: boolean;
  vectorExtension: string | null;
  notes: string;
  sqlDialectDiff?: string[];
}

export interface LLMAdapterInfo {
  provider: LLMProvider;
  endpoint: string;
  models: { chat: string; embedding: string };
  apiFormat: 'openai' | 'custom';
  notes: string;
}

export interface GMCryptoConfig {
  algorithms: {
    asymmetric: { name: string; keySize: number; usage: string };
    hash: { name: string; outputSize: number; usage: string };
    symmetric: { name: string; blockSize: number; keySize: number; usage: string };
  };
  tls: {
    protocol: string;
    cipherSuites: string[];
    certificateType: string;
  };
  compliance: {
    standard: string;
    certificationBody: string;
    level: string;
  };
  implementation: {
    library: string;
    fallback: string;
    notes: string;
  };
}

// ============================================================
// 升级管理
// ============================================================

export interface UpgradeStrategy {
  type: 'rolling' | 'blue_green' | 'canary';
  rollbackOnFailure: boolean;
  healthCheckInterval: number;
  maxUnavailable: number;
  canaryPercentage?: number;
}

export class UpgradeManager {
  /**
   * 生成升级计划
   */
  generateUpgradePlan(fromVersion: string, toVersion: string, strategy: UpgradeStrategy): UpgradePlan {
    return {
      fromVersion,
      toVersion,
      strategy,
      steps: [
        { order: 1, name: 'pre_check', description: '升级前检查（磁盘/内存/连接数）', duration: '1min' },
        { order: 2, name: 'backup', description: '全量备份（数据库+Redis+文件）', duration: '5-30min' },
        { order: 3, name: 'migration', description: '数据库Schema迁移', duration: '1-5min' },
        { order: 4, name: 'deploy', description: `${strategy.type}部署新版本`, duration: '2-10min' },
        { order: 5, name: 'verify', description: '健康检查 + 冒烟测试', duration: '2min' },
        { order: 6, name: 'traffic_shift', description: '流量切换（Canary渐进/Blue-Green切换）', duration: '5-30min' },
        { order: 7, name: 'post_check', description: '升级后验证（SLO/错误率/延迟）', duration: '5min' },
        { order: 8, name: 'cleanup', description: '清理旧版本资源', duration: '1min' },
      ],
      rollbackPlan: {
        trigger: '健康检查失败 或 错误率 > 5% 或 P99延迟 > 5s',
        steps: ['停止新版本部署', '恢复旧版本流量', '回滚数据库迁移（如有down migration）', '通知运维团队'],
        maxRollbackTime: '5min',
      },
      estimatedDowntime: strategy.type === 'rolling' ? '0' : strategy.type === 'blue_green' ? '< 1s' : '0',
    };
  }
}

export interface UpgradePlan {
  fromVersion: string;
  toVersion: string;
  strategy: UpgradeStrategy;
  steps: Array<{ order: number; name: string; description: string; duration: string }>;
  rollbackPlan: { trigger: string; steps: string[]; maxRollbackTime: string };
  estimatedDowntime: string;
}

// ============================================================
// 单例导出
// ============================================================

export const dockerComposeGenerator = new DockerComposeGenerator();
export const k8sManifestGenerator = new K8sManifestGenerator();
export const helmChartGenerator = new HelmChartGenerator();
export const airGapDeployer = new AirGapDeployer();
export const domesticAdapter = new DomesticAdapter();
export const upgradeManager = new UpgradeManager();

// 默认部署配置模板
export const DEPLOYMENT_TEMPLATES: Record<string, Partial<DeploymentConfig>> = {
  // 最小化单机部署
  minimal: {
    mode: 'private_cloud',
    infrastructure: {
      database: { type: 'postgres', host: 'localhost', port: 5432, database: 'atos', username: 'atos', password: '', ssl: false, poolSize: 10 },
      cache: { type: 'redis', hosts: ['localhost:6379'], db: 0, maxMemory: '256mb' },
      storage: { type: 'minio', endpoint: 'http://localhost:9000', bucket: 'atos', accessKey: '', secretKey: '' },
    },
    ai: { llmProvider: 'deepseek', llmEndpoint: 'https://api.deepseek.com/v1', llmModel: 'deepseek-chat', embeddingProvider: 'deepseek', embeddingModel: 'deepseek-embedding', embeddingEndpoint: 'https://api.deepseek.com/v1' },
    security: { cryptoMode: 'standard', tlsVersion: '1.3' },
    ha: { enabled: false, replicas: 1, regions: ['cn-chengdu'], failoverStrategy: 'active_passive' },
    resources: { cpu: '2', memory: '4Gi', storage: '50Gi', gpuRequired: false },
  },
  // 国企标准部署
  enterprise_cn: {
    mode: 'private_cloud',
    infrastructure: {
      database: { type: 'kingbase', host: 'db.internal', port: 54321, database: 'atos', username: 'atos', password: '', ssl: true, poolSize: 50 },
      cache: { type: 'redis_sentinel', hosts: ['redis-1:26379', 'redis-2:26379', 'redis-3:26379'], db: 0, maxMemory: '2gb', sentinelMaster: 'atos-master' },
      storage: { type: 'obs', endpoint: 'https://obs.cn-southwest-2.myhuaweicloud.com', bucket: 'atos-files', accessKey: '', secretKey: '', region: 'cn-southwest-2' },
    },
    ai: { llmProvider: 'qwen', llmEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', llmModel: 'qwen-max', embeddingProvider: 'qwen', embeddingModel: 'text-embedding-v3', embeddingEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    security: { cryptoMode: 'gm', tlsVersion: '1.2' },
    ha: { enabled: true, replicas: 3, regions: ['cn-chengdu', 'cn-chongqing'], failoverStrategy: 'active_passive' },
    resources: { cpu: '8', memory: '16Gi', storage: '500Gi', gpuRequired: false },
  },
  // 离线部署（军工/涉密）
  air_gap: {
    mode: 'air_gap',
    infrastructure: {
      database: { type: 'dameng', host: '10.0.0.10', port: 5236, database: 'atos', username: 'atos', password: '', ssl: true, poolSize: 30 },
      cache: { type: 'redis', hosts: ['10.0.0.11:6379'], db: 0, maxMemory: '1gb' },
      storage: { type: 'minio', endpoint: 'http://10.0.0.12:9000', bucket: 'atos', accessKey: '', secretKey: '' },
    },
    ai: { llmProvider: 'custom', llmEndpoint: 'http://10.0.0.20:8000/v1', llmModel: 'qwen2.5-72b', embeddingProvider: 'custom', embeddingModel: 'bge-large-zh-v1.5', embeddingEndpoint: 'http://10.0.0.20:8000/v1' },
    security: { cryptoMode: 'gm', tlsVersion: '1.2' },
    ha: { enabled: true, replicas: 3, regions: ['zone-a', 'zone-b'], failoverStrategy: 'active_passive' },
    resources: { cpu: '16', memory: '32Gi', storage: '1Ti', gpuRequired: true },
  },
};
