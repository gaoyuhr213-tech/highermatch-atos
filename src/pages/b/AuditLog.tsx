import { useState } from 'react';
import { Shield, Clock, User, FileText, AlertTriangle, CheckCircle, Search, Filter, Download, Lock, Eye, Database } from 'lucide-react';
import { motion } from 'framer-motion';

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
}

const mockAuditLog: AuditEntry[] = [
  { id: 'A-001', timestamp: '2024-03-15 14:32:18', actor: '管理员', actorRole: 'HRD', action: '查看候选人详情', resource: '张明远 - 高级算法工程师', resourceType: 'candidate', result: 'success', ip: '192.168.1.100', sm3Hash: 'a3f2c8d1...e91b', details: '正常访问，权限校验通过', tenantId: 'T-SHUDAO' },
  { id: 'A-002', timestamp: '2024-03-15 14:28:05', actor: '管理员', actorRole: 'HRD', action: '审批决策提案', resource: 'D-001 Hire决策', resourceType: 'decision', result: 'success', ip: '192.168.1.100', sm3Hash: 'b7d1a4f3...f03c', details: '决策审批通过，SM2签名已验证', tenantId: 'T-SHUDAO' },
  { id: 'A-003', timestamp: '2024-03-15 14:15:42', actor: '外部用户', actorRole: 'Unknown', action: '越权访问企业数据', resource: '蜀道集团-内部薪资数据', resourceType: 'system', result: 'denied', ip: '10.0.0.55', sm3Hash: 'c4e9b2a7...d17a', details: '租户隔离拦截：非本企业用户，访问被拒绝', tenantId: 'T-UNKNOWN' },
  { id: 'A-004', timestamp: '2024-03-15 13:58:30', actor: '李HR', actorRole: 'Recruiter', action: 'U盾登录认证', resource: '系统登录', resourceType: 'auth', result: 'success', ip: '192.168.1.102', sm3Hash: 'd8f3c1b5...a42e', details: 'U盾PIN验证+SM2签名+CA鉴权，三步验证通过', tenantId: 'T-SHUDAO' },
  { id: 'A-005', timestamp: '2024-03-15 13:45:12', actor: '系统', actorRole: 'AI Agent', action: '生成决策提案', resource: 'D-004 Retain决策', resourceType: 'decision', result: 'success', ip: 'internal', sm3Hash: 'e2a7d5c9...b89f', details: 'AI Agent生成保留决策，置信度95%，14条证据链', tenantId: 'T-SHUDAO' },
  { id: 'A-006', timestamp: '2024-03-15 13:30:08', actor: '王经理', actorRole: 'Hiring Manager', action: '导出候选人报告', resource: '面试评估报告-批量', resourceType: 'candidate', result: 'warning', ip: '192.168.1.105', sm3Hash: 'f1b8e3d2...c56a', details: '批量导出触发k-匿名校验(k≥20)，部分字段已脱敏', tenantId: 'T-SHUDAO' },
  { id: 'A-007', timestamp: '2024-03-15 12:15:33', actor: '外部用户', actorRole: 'Candidate', action: '尝试访问其他企业岗位数据', resource: '川投集团-内部岗位', resourceType: 'system', result: 'denied', ip: '10.0.0.78', sm3Hash: 'g4c2f7a1...d89b', details: '数据隔离：候选人无权访问企业专属内容', tenantId: 'T-CHUANTOU' },
];

const resultConfig = {
  success: { label: '成功', icon: CheckCircle, color: 'text-trust-600 bg-trust-50 border-trust-100' },
  denied: { label: '拒绝', icon: Lock, color: 'text-error-600 bg-error-50 border-error-100' },
  warning: { label: '告警', icon: AlertTriangle, color: 'text-warning-600 bg-warning-50 border-warning-100' },
};

const resourceTypeConfig = {
  candidate: { label: '候选人', color: 'bg-primary-50 text-primary-700' },
  position: { label: '岗位', color: 'bg-emerald-50 text-emerald-700' },
  decision: { label: '决策', color: 'bg-violet-50 text-violet-700' },
  system: { label: '系统', color: 'bg-slate-100 text-slate-700' },
  auth: { label: '认证', color: 'bg-amber-50 text-amber-700' },
};

export default function AuditLog() {
  const [filterResult, setFilterResult] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = filterResult === 'all'
    ? mockAuditLog
    : mockAuditLog.filter(l => l.result === filterResult);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">操作审计日志</h1>
          <p className="text-sm text-slate-500 mt-1">全量操作可追溯 · 越权访问实时拦截 · 等保合规审计</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            导出日志
          </button>
          <div className="px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200">
            <span className="text-xs font-semibold text-trust-700">等保三级合规</span>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary-500" />
            <span className="text-xs text-slate-500">今日操作总量</span>
          </div>
          <p className="text-xl font-bold text-slate-900">1,247</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-error-500" />
            <span className="text-xs text-slate-500">越权拦截</span>
          </div>
          <p className="text-xl font-bold text-error-600">3</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            <span className="text-xs text-slate-500">安全告警</span>
          </div>
          <p className="text-xl font-bold text-warning-600">2</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-trust-500" />
            <span className="text-xs text-slate-500">租户隔离有效率</span>
          </div>
          <p className="text-xl font-bold text-trust-600">100%</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索操作人、资源、IP..."
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'success', 'denied', 'warning'].map(f => (
            <button
              key={f}
              onClick={() => setFilterResult(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterResult === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? '全部' : resultConfig[f as keyof typeof resultConfig].label}
            </button>
          ))}
        </div>
      </div>

      {/* 日志表格 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">时间</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">操作人</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">资源</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">结果</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SM3 Hash</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.map((entry) => {
                const resConf = resultConfig[entry.result];
                const resTypeConf = resourceTypeConfig[entry.resourceType];
                return (
                  <tr key={entry.id} className="hover:bg-slate-25 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 font-mono">{entry.timestamp}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-xs font-medium text-slate-800">{entry.actor}</span>
                        <p className="text-[10px] text-slate-400">{entry.actorRole}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-700">{entry.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${resTypeConf.color}`}>
                          {resTypeConf.label}
                        </span>
                        <span className="text-xs text-slate-600 truncate max-w-[160px]">{entry.resource}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${resConf.color}`}>
                        <resConf.icon className="w-3 h-3" />
                        {resConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-slate-400">{entry.sm3Hash}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-slate-500 max-w-[200px] truncate block">{entry.details}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
