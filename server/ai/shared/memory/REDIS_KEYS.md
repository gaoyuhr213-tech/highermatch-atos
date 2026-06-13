# Redis Key Design — 蓉才通™ ATOS

## Naming Convention

```
{module}:{tenant}:{entity}:{id}:{field}
```

## Interview Module

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `interview:session:{sessionId}` | Hash | 4h | Active session state |
| `interview:session:{sessionId}:transcript` | List | 4h | Ordered transcript entries |
| `interview:session:{sessionId}:scores` | Hash | 4h | Real-time score accumulator |
| `interview:session:{sessionId}:agents` | Hash | 4h | Agent execution state |
| `interview:agent:{sessionId}:{agentName}:memory` | String (JSON) | 4h | Agent working memory |
| `interview:tenant:{tenantId}:active` | Set | - | Active session IDs per tenant |

## Resume Module

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `resume:parse:{jobId}` | Hash | 1h | Parse job progress/status |
| `resume:cache:{hash}` | String (JSON) | 24h | Parsed resume cache (content hash) |
| `resume:ranking:{positionId}` | Sorted Set | 1h | Candidate rankings by score |

## People Module

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `people:search:{queryHash}` | String (JSON) | 15m | Search result cache |
| `people:outreach:{sequenceId}:state` | Hash | 30d | Outreach sequence state |
| `people:ratelimit:{tenantId}:search` | String (counter) | 1m | Search rate limiter |

## Copilot Module

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `copilot:mock:{sessionId}` | Hash | 2h | Mock interview session state |
| `copilot:mock:{sessionId}:history` | List | 2h | Q&A history |
| `copilot:salary:cache:{queryHash}` | String (JSON) | 7d | Salary data cache |

## Queue Keys (BullMQ)

| Key Pattern | Description |
|-------------|-------------|
| `bull:whisper:*` | Whisper transcription jobs |
| `bull:resume-parse:*` | Resume parsing jobs |
| `bull:embedding:*` | Vector embedding generation |
| `bull:report-generate:*` | Report generation jobs |
| `bull:outreach-send:*` | Email sending jobs |

## Rate Limiting

| Key Pattern | Type | TTL | Limit |
|-------------|------|-----|-------|
| `ratelimit:{tenantId}:llm:minute` | Counter | 60s | 60 req/min |
| `ratelimit:{tenantId}:llm:day` | Counter | 86400s | 5000 req/day |
| `ratelimit:{tenantId}:search` | Counter | 60s | 30 req/min |
| `ratelimit:{tenantId}:outreach` | Counter | 3600s | 100 emails/hour |
