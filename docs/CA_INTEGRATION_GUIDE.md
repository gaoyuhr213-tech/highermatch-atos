# 四川CA政务网关对接说明

**版本**: v1.0  
**适用系统**: 蓉才通™ HigherMatch ATOS  
**对接方**: 四川省数字证书认证管理中心

---

## 1. 架构概述

蓉才通系统采用**单一接口收敛设计**，所有CA校验请求统一通过 `TrustGateway` 模块路由至四川CA政务网关。当前系统内置Mock适配器用于开发环境，生产环境切换仅需替换适配器实现，无需修改业务层代码。

**信任传导链路**：U盾硬件 → PIN验证 → SM2签名 → CA网关鉴权 → 身份写入信用底座 → 认证标识挂载

---

## 2. 接口规范

### 2.1 U盾登录认证接口

| 字段 | 说明 |
|------|------|
| 接口路径 | `POST /api/trust/auth/ushield` |
| 请求方式 | HTTPS (TLS 1.3) |
| 签名算法 | 国密SM2 |
| 哈希算法 | 国密SM3 |
| 超时时间 | 5000ms |

**请求参数**：

```json
{
  "certSerialNo": "string (U盾证书序列号)",
  "signedChallenge": "string (SM2签名的随机挑战值)",
  "timestamp": "number (Unix毫秒时间戳)",
  "deviceFingerprint": "string (设备指纹哈希)"
}
```

**响应参数**：

```json
{
  "code": 0,
  "data": {
    "verified": true,
    "enterpriseId": "string (统一社会信用代码)",
    "enterpriseName": "string (企业名称)",
    "certLevel": "EV|OV|DV",
    "validUntil": "ISO8601",
    "sm3Hash": "string (本次认证的SM3存证哈希)",
    "scopedToken": "string (有限时效的访问令牌)"
  }
}
```

### 2.2 企业认证状态查询接口

| 字段 | 说明 |
|------|------|
| 接口路径 | `GET /api/trust/enterprise/{enterpriseId}/status` |
| 鉴权方式 | Bearer Token (ScopedToken) |
| 缓存策略 | 300s TTL |

### 2.3 操作存证接口

| 字段 | 说明 |
|------|------|
| 接口路径 | `POST /api/trust/evidence/store` |
| 存证类型 | 决策审批 / 岗位发布 / 面试评分 / 背书签发 |
| 存证格式 | SM3哈希 + 时间戳 + 操作人证书序列号 |

---

## 3. 生产环境切换步骤

### 3.1 环境变量配置

```env
# .env.production
VITE_CA_GATEWAY_URL=https://ca-gateway.scca.com.cn/api/v2
VITE_CA_APP_ID=highermatch_atos_prod
VITE_CA_APP_SECRET=<由四川CA分配>
VITE_CA_CERT_PATH=/etc/ssl/scca/server.pem
VITE_TRUST_MODE=production
```

### 3.2 适配器切换

系统内置两个适配器实现：

| 适配器 | 用途 | 文件路径 |
|--------|------|----------|
| `MockCAAdapter` | 开发/测试环境 | `src/lib/trust/adapters/mock.ts` |
| `SCCAAdapter` | 生产环境(四川CA) | `src/lib/trust/adapters/scca.ts` |

切换方式：修改 `src/lib/trust/gateway.ts` 中的工厂方法：

```typescript
// gateway.ts
import { SCCAAdapter } from './adapters/scca';
import { MockCAAdapter } from './adapters/mock';

export function createCAAdapter() {
  if (import.meta.env.VITE_TRUST_MODE === 'production') {
    return new SCCAAdapter({
      gatewayUrl: import.meta.env.VITE_CA_GATEWAY_URL,
      appId: import.meta.env.VITE_CA_APP_ID,
      appSecret: import.meta.env.VITE_CA_APP_SECRET,
    });
  }
  return new MockCAAdapter();
}
```

### 3.3 国密SDK集成

生产环境需安装四川CA提供的国密SDK：

```bash
npm install @scca/gm-crypto @scca/ushield-driver
```

---

## 4. 安全要求

| 要求项 | 实现方式 |
|--------|----------|
| 传输加密 | TLS 1.3 + 国密SM4 |
| 请求签名 | SM2非对称签名 |
| 防重放 | Timestamp + Nonce双重校验 |
| 证书固定 | Certificate Pinning |
| 日志脱敏 | 证书序列号仅保留前4后4位 |
| 审计存证 | 每次认证操作SM3哈希上链 |

---

## 5. 错误码对照

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| `CA_001` | U盾未插入 | 提示用户插入U盾 |
| `CA_002` | PIN码错误 | 提示重试，3次锁定 |
| `CA_003` | 证书已过期 | 引导至CA中心续期 |
| `CA_004` | 签名验证失败 | 检查时钟同步 |
| `CA_005` | 企业未注册 | 引导至CA中心注册 |
| `CA_006` | 网关超时 | 自动重试(最多2次) |
| `CA_007` | 租户隔离违规 | 拒绝访问+审计告警 |

---

## 6. 测试验证

### 6.1 Mock模式验证

开发环境下，Mock适配器提供以下测试凭证：

| 测试企业 | 证书序列号 | 预期结果 |
|----------|-----------|----------|
| 蜀道集团 | `MOCK-CERT-001` | 认证成功 |
| 川投集团 | `MOCK-CERT-002` | 认证成功 |
| 测试过期 | `MOCK-CERT-EXPIRED` | CA_003错误 |
| 测试锁定 | `MOCK-CERT-LOCKED` | CA_002错误 |

### 6.2 生产验收标准

| 验收项 | 标准 |
|--------|------|
| 认证成功率 | ≥99.5% |
| 平均响应时间 | ≤800ms |
| 并发支持 | ≥500 TPS |
| 故障自愈 | 30s内自动切换备用节点 |
