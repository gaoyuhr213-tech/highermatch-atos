/**
 * AuditLog — 操作审计日志
 * PRD §8.1.10: DataTable/correlationId/签名主体+操作人下钻
 * Mock标注：数据为前端模拟，生产环境对接 /api/v2/audit/logs
 */
import { useState } from 'react';
import { Search, Download, Database, Shield, Lock, AlertTriangle, CheckCircle, Fingerprint } from 'lucide-react';
import { DataTable, type Column } from '../../components/DataTable';
import { OperatorBadge } from '../../components/OperatorBadge';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceType: 'candidate' | 'position' | 'decision' | 'system' | 'auth';
  result: 'success' | 'denied' | 'warning';
  ip: string;
  sm3Hash: string;
  details: string;
  tenantId: string;
  correlationId: string;
  signerSubject: string;
  operatorSeat: string;
}

const mockAuditLog: AuditEntry[] = [
  { id: 'A-001', timestamp: '2024-03-15 14:32:18', actor: '管理员', actorRole: 'HRD', action: '查看候选人详情', resource: '张明远 - 高级算法工程师', resourceType: 'candidate', result: 'success', ip: '192.168.1.100', sm3Hash: 'a3f2c8d1...e91b', details: '正常访问，权限校验通过', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-001', signerSubject: '蜀道集团有限公司', operatorSeat: '张三 · 席位A01' },
  { id: 'A-002', timestamp: '2024-03-15 14:28:05', actor: '管理员', actorRole: 'HRD', action: '审批决策提案', resource: 'D-001 Hire决策', resourceType: 'decision', result: 'success', ip: '192.168.1.100', sm3Hash: 'b7d1a4f3...f03c', details: '决策审批通过，SM2签名已验证', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-002', signerSubject: '蜀道集团有限公司', operatorSeat: '张三 · 席位A01' },
  { id: 'A-003', timestamp: '2024-03-15 14:15:42', actor: '外部用户', actorRole: 'Unknown', action: '越权访问企业数据', resource: '蜀道集团-内部薪资数据', resourceType: 'system', result: 'denied', ip: '10.0.0.55', sm3Hash: 'c4e9b2a7...d17a', details: '租户隔离拦截：非本企业用户，访问被拒绝', tenantId: 'T-UNKNOWN', correlationId: 'COR-20240315-003', signerSubject: '未知主体', operatorSeat: '未授权' },
  { id: 'A-004', timestamp: '2024-03-15 13:58:30', actor: '李HR', actorRole: 'Recruiter', action: 'U盾登录认证', resource: '系统登录', resourceType: 'auth', result: 'success', ip: '192.168.1.102', sm3Hash: 'd8f3c1b5...a42e', details: 'U盾PIN验证+SM2签名+CA鉴权，三步验证通过', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-004', signerSubject: '蜀道集团有限公司', operatorSeat: '李HR · 席位B03' },
  { id: 'A-005', timestamp: '2024-03-15 13:45:12', actor: '系统', actorRole: 'AI Agent', action: '生成决策提案', resource: 'D-004 Retain决策', resourceType: 'decision', result: 'success', ip: 'internal', sm3Hash: 'e2a7d5c9...b89f', details: 'AI Agent生成保留决策，置信度95%，14条证据链', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-005', signerSubject: '蓉才通™ AI Agent', operatorSeat: 'AI · 自动席位' },
  { id: 'A-006', timestamp: '2024-03-15 13:30:08', actor: '王经理', actorRole: 'Hiring Manager', action: '导出候选人报告', resource: '面试评估报告-批量', resourceType: 'candidate', result: 'warning', ip: '192.168.1.105', sm3Hash: 'f1b8e3d2...c56a', details: '批量导出触发k-匿名校验(k≥20)，部分字段已脱敏', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-006', signerSubject: '蜀道集团有限公司', operatorSeat: '王经理 · 席位C07' },
  { id: 'A-007', timestamp: '2024-03-15 12:15:33', actor: '外部用户', actorRole: 'Candidate', action: '尝试访问其他企业岗位数据', resource: '川投集团-内部岗位', resourceType: 'system', result: 'denied', ip: '10.0.0.78', sm3Hash: 'g4c2f7a1...d89b', details: '数据隔离：候选人无权访问企业专属内容', tenantId: 'T-CHUANTOU', correlationId: 'COR-20240315-007', signerSubject: '未知主体', operatorSeat: '未授权' },
  { id: 'A-008', timestamp: '2024-03-15 11:42:19', actor: '赵总监', actorRole: 'CHRO', action: '查看组织健康仪表盘', resource: '组织健康指标', resourceType: 'system', result: 'success', ip: '192.168.1.108', sm3Hash: 'h5d3e8f2...a14c', details: '高管权限访问，数据完整展示', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-008', signerSubject: '蜀道集团有限公司', operatorSeat: '赵总监 · 席位A02' },
  { id: 'A-009', timestamp: '2024-03-15 10:20:45', actor: '系统', actorRole: 'Scheduler', action: '定时同步人才库', resource: '外部人才数据源', resourceType: 'system', result: 'success', ip: 'internal', sm3Hash: 'i6e4f9g3...b25d', details: '增量同步完成，新增候选人12人', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-009', signerSubject: '蓉才通™ Scheduler', operatorSeat: 'System · 自动' },
  { id: 'A-010', timestamp: '2024-03-15 09:15:02', actor: '张三', actorRole: 'HRD', action: '修改岗位薪资范围', resource: '高级算法工程师 - 薪资', resourceType: 'position', result: 'success', ip: '192.168.1.100', sm3Hash: 'j7f5g0h4...c36e', details: '薪资范围调整：35-50k → 40-60k，需二次审批', tenantId: 'T-SHUDAO', correlationId: 'COR-20240315-010', signerSubject: '蜀道集团有限公司', operatorSeat: '张三 · 席位A01' },
];

const resultConfig = {
  success: { label: '成功', icon: CheckCircle, color: 'text-trust-600 bg-trust-50 border-trust-100' },
  denied: { label: '拒绝', icon: Lock, color: 'text-risk-600 bg-risk-50 border-risk-100' },
  warning: { label: '告警', icon: AlertTriangle, color: 'text-warn-600 bg-warn-50 border-warn-100' },
};

const resourceTypeConfig: Record<string, { label: string; color: string }> = {
  candidate: { label: '候选人', color: 'bg-brand-50 text-brand-700' },
  position: { label: '岗位', color: 'bg-emerald-50 text-emerald-700' },
  decision: { label: '决策', color: 'bg-violet-50 text-violet-700' },
  system: { label: '系统', color: 'bg-ink-100 text-ink-700' },
  auth: { label: '认证', color: 'bg-amber-50 text-amber-700' },
};

export default function AuditLog() {
  const [filterResult, setFilterResult] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const filteredLogs = mockAuditLog.filter(entry => {
    if (filterResult !== 'all' && entry.result !== filterResult) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return entry.actor.toLowerCase().includes(q)
        || entry.resource.toLowerCase().includes(q)
        || entry.ip.includes(q)
        || entry.correlationId.toLowerCase().includes(q);
    }
    return true;
  });

  const columns: Column<AuditEntry>[] = [
    { key: 'timestamp', label: '时间', width: '140px', sortable: true, mono: true, render: (row) => <span className="text-xs">{row.timestamp}</span> },
    { key: 'actor', label: '操作人', width: '140px', sortable: true, render: (row) => (<div><span className="text-xs font-medium text-foreground">{row.actor}</span><p className="text-[10px] text-muted">{row.actorRole}</p></div>) },
    { key: 'action', label: '操作', sortable: true, render: (row) => <span className="text-xs text-foreground">{row.action}</span> },
    { key: 'resource', label: '资源', width: '200px', render: (row) => (<div className="flex items-center gap-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${resourceTypeConfig[row.resourceType]?.color || ''}`}>{resourceTypeConfig[row.resourceType]?.label || row.resourceType}</span><span className="text-xs text-foreground truncate max-w-[120px]">{row.resource}</span></div>) },
    { key: 'result', label: '结果', width: '80px', sortable: true, render: (row) => { const conf = resultConfig[row.result]; const Icon = conf.icon; return (<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${conf.color}`}><Icon className="w-3 h-3" />{conf.label}</span>); } },
    { key: 'correlationId', label: 'Correlation ID', width: '150px', mono: true, render: (row) => <span className="text-[10px]">{row.correlationId}</span> },
    { key: 'sm3Hash', label: 'SM3 Hash', width: '110px', mono: true, render: (row) => <span className="text-[10px] text-muted">{row.sm3Hash}</span> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">操作审计日志</h1>
          <p className="text-sm text-muted mt-1">全量操作可追溯 · 越权访问实时拦截 · 等保合规审计 · <span className="text-[10px] font-mono text-muted">[Mock: 前端模拟数据]</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-border text-sm font-medium text-foreground hover:bg-ink-50 transition-colors">
            <Download className="w-4 h-4" />导出日志
          </button>
          <div className="px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200">
            <span className="text-xs font-semibold text-trust-700">等保三级合规</span>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-brand-500" /><span className="text-xs text-muted">今日操作总量</span></div>
          <p className="text-xl font-bold text-foreground tabular-nums">1,247</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-risk-500" /><span className="text-xs text-muted">越权拦截</span></div>
          <p className="text-xl font-bold text-risk-600 tabular-nums">3</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Fingerprint className="w-4 h-4 text-trust-500" /><span className="text-xs text-muted">SM2签名覆盖率</span></div>
          <p className="text-xl font-bold text-trust-600 tabular-nums">100%</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-trust-500" /><span className="text-xs text-muted">租户隔离有效率</span></div>
          <p className="text-xl font-bold text-trust-600 tabular-nums">100%</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索操作人、资源、IP、Correlation ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 text-foreground placeholder:text-muted" />
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'success', 'denied', 'warning'] as const).map(f => (
            <button key={f} onClick={() => setFilterResult(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterResult === f ? 'bg-brand-600 text-white' : 'bg-surface text-foreground border border-border hover:bg-ink-50'}`}>
              {f === 'all' ? '全部' : resultConfig[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* DataTable */}
      <DataTable columns={columns} data={filteredLogs} rowKey={(row) => row.id} pageSize={10} onRowClick={(row) => setSelectedEntry(row)} />

      {/* 详情抽屉 */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-ink-950/30 backdrop-blur-sm flex items-center justify-end z-50" onClick={() => setSelectedEntry(null)}>
          <div className="w-[480px] h-full bg-surface border-l border-border p-6 overflow-y-auto animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-foreground">审计详情</h3>
              <button onClick={() => setSelectedEntry(null)} className="p-1.5 rounded-lg hover:bg-ink-100 text-muted">✕</button>
            </div>
            {/* 签名主体 */}
            <div className="p-4 bg-trust-50 rounded-xl border border-trust-100 mb-4">
              <p className="text-[10px] font-semibold text-trust-700 mb-1">签名主体</p>
              <p className="text-sm font-medium text-trust-800">{selectedEntry.signerSubject}</p>
              <p className="text-[10px] text-trust-600 font-mono mt-1">SM3: {selectedEntry.sm3Hash}</p>
            </div>
            {/* 操作人 */}
            <div className="p-4 bg-ink-50 rounded-xl border border-border mb-4">
              <p className="text-[10px] font-semibold text-muted mb-1">操作人席位</p>
              <div className="flex items-center gap-2">
                <OperatorBadge name={selectedEntry.actor} role={selectedEntry.actorRole} />
                <span className="text-xs text-muted font-mono">{selectedEntry.operatorSeat}</span>
              </div>
            </div>
            {/* 详细信息 */}
            <div className="space-y-3">
              {([['Correlation ID', selectedEntry.correlationId], ['操作', selectedEntry.action], ['资源', selectedEntry.resource], ['IP', selectedEntry.ip], ['租户', selectedEntry.tenantId], ['时间', selectedEntry.timestamp], ['详情', selectedEntry.details]] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-[10px] text-muted w-24 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-xs text-foreground font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
