/**
 * DashboardLayout — PRD §6 App Shell
 * 
 * 侧边栏（可折叠）+ 顶部导航栏 + 内容区
 * 信任身份展示 + 操作人标识 + 签名主体
 * 快捷键面板入口 + 全局搜索
 */
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, GitBranch, Network, Search, Video, Bot, Send, Award,
  Star, Gift, Users, Building2, Shield, LogOut, ChevronDown, Fingerprint,
  MessageSquare, BarChart3, FileText, Compass, PanelLeftClose, PanelLeftOpen,
  Command, Bell
} from 'lucide-react';
import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import type { Role } from '../App';
import { useTrustedSession } from '../lib/trust/session';

interface Props { children: ReactNode; }

const roleConfig: Record<Role, { label: string; icon: typeof Building2; color: string; nav: { path: string; label: string; icon: typeof LayoutDashboard }[] }> = {
  employer: { label: 'B端 · 雇主/HRD', icon: Building2, color: 'text-brand-600', nav: [
    { path: '/b/command', label: '决策总控台', icon: LayoutDashboard },
    { path: '/b/pipeline', label: '招聘流水线', icon: GitBranch },
    { path: '/b/graph', label: '人才图谱', icon: Network },
    { path: '/b/sourcing', label: 'AI 寻访', icon: Search },
    { path: '/b/interview', label: '面试监控', icon: Video },
    { path: '/b/job-qa', label: '岗位真实答疑', icon: MessageSquare },
    { path: '/b/community', label: '同行互助圈', icon: Users },
    { path: '/b/efficiency', label: '提效看板', icon: BarChart3 },
    { path: '/b/audit', label: '审计日志', icon: FileText },
  ]},
  candidate: { label: 'C端 · 候选人', icon: Users, color: 'text-trust-600', nav: [
    { path: '/c/coach', label: 'AI 职业教练', icon: Bot },
    { path: '/c/apply', label: '智能投递', icon: Send },
    { path: '/c/endorsement', label: '背书卡片', icon: Award },
    { path: '/c/decision-hub', label: '决策社区', icon: Compass },
  ]},
  expert: { label: '专家端 · 评审', icon: Star, color: 'text-warn-600', nav: [
    { path: '/expert/reviews', label: '评审任务', icon: Star },
    { path: '/expert/rewards', label: '积分奖励', icon: Gift },
  ]},
  soe: { label: '国企端 · 组织', icon: Building2, color: 'text-purple-600', nav: [
    { path: '/soe/succession', label: '继任沙盘', icon: Users },
    { path: '/soe/commons', label: '人才共享', icon: Network },
  ]},
};

const roles: Role[] = ['employer', 'candidate', 'expert', 'soe'];

export default function DashboardLayout({ children }: Props) {
  const { role, setRole, setAuthenticated, setShowLineage } = useApp();
  const { identity, getSignerDisplay, getOperatorDisplay, clearIdentity } = useTrustedSession();
  const [roleDropdown, setRoleDropdown] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const config = roleConfig[role];

  const handleSwitch = (r: Role) => { setRole(r); setRoleDropdown(false); navigate(roleConfig[r].nav[0].path); };
  const handleLogout = () => { setAuthenticated(false); clearIdentity(); };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ─── 侧边栏 ─── */}
      <aside className={`flex flex-col border-r border-border bg-surface/80 backdrop-blur-xl transition-all duration-200 ease-out flex-shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}>
        {/* Logo + 折叠按钮 */}
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-trust-500 to-trust-700 flex items-center justify-center shadow-sm flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold text-foreground tracking-tight">蓉才通™</h1>
                <p className="text-[10px] text-muted font-medium">HigherMatch ATOS</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button aria-label="收起侧边栏" onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg hover:bg-ink-100 text-muted transition-colors">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 折叠时展开按钮 */}
        {collapsed && (
          <div className="px-2 py-2 border-b border-border">
            <button aria-label="展开侧边栏" onClick={() => setCollapsed(false)} className="w-full p-2 rounded-lg hover:bg-ink-100 text-muted transition-colors flex justify-center">
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Role Switcher */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-border">
            <div className="relative">
              <button onClick={() => setRoleDropdown(!roleDropdown)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ink-50 hover:bg-ink-100 transition-colors">
                <config.icon className={`w-4 h-4 ${config.color}`} />
                <span className="text-sm font-medium text-foreground flex-1 text-left">{config.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${roleDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {roleDropdown && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-xl border border-border shadow-e3 z-50 overflow-hidden">
                    {roles.map(r => (
                      <button key={r} onClick={() => handleSwitch(r)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-ink-50 transition-colors ${r === role ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-foreground'}`}>
                        {(() => { const Icon = roleConfig[r].icon; return <Icon className="w-4 h-4" />; })()}
                        <span>{roleConfig[r].label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-3 mb-2">功能导航</p>
          )}
          {config.nav.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center' : ''
              } ${isActive ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-foreground hover:bg-ink-50 hover:text-foreground'}`}
              title={collapsed ? item.label : undefined}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {!collapsed && (
            <div className="pt-4 mt-4 border-t border-border">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-3 mb-2">快捷操作</p>
              <button onClick={() => setShowLineage(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-ink-50 transition-all">
                <Fingerprint className="w-4 h-4" /><span>决策血统追溯</span>
              </button>
            </div>
          )}
        </nav>

        {/* 底部：信任身份 + 操作人 */}
        <div className="px-3 py-3 border-t border-border">
          {!collapsed ? (
            <div className="space-y-2">
              {/* 签名主体 */}
              {identity && (
                <div className="px-3 py-2 bg-trust-50 rounded-xl border border-trust-100">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Shield className="w-3 h-3 text-seal-ev" />
                    <span className="text-[10px] font-semibold text-trust-700">签名主体</span>
                    <span className="text-[9px] px-1 py-0.5 bg-seal-ev/10 text-seal-ev rounded font-bold ml-auto">{identity.certLevel}</span>
                  </div>
                  <p className="text-xs text-trust-800 font-medium truncate">{identity.enterprise}</p>
                  <p className="text-[10px] text-trust-600 font-mono truncate">SM2:{identity.certSerial.slice(-8)}</p>
                </div>
              )}
              {/* 操作人 */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {identity?.operator?.charAt(0) || '管'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{identity?.operator || '管理员'}</p>
                  <p className="text-[10px] text-muted">席位授权 · 操作人</p>
                </div>
                <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-ink-100 text-muted hover:text-risk-600 transition-colors" title="退出登录">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold">
                {identity?.operator?.charAt(0) || '管'}
              </div>
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-ink-100 text-muted hover:text-risk-600 transition-colors" title="退出登录">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── 主内容区 ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="h-12 border-b border-border bg-surface/60 backdrop-blur-sm flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1" />
          {/* 全局搜索 */}
          <button className="flex items-center gap-2 px-3 py-1.5 bg-ink-50 hover:bg-ink-100 rounded-lg text-sm text-muted transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>搜索...</span>
            <kbd className="text-[10px] px-1.5 py-0.5 bg-surface border border-border rounded font-mono shadow-sm ml-4">⌘K</kbd>
          </button>
          <div className="flex items-center gap-2">
            <button aria-label="通知" className="p-2 hover:bg-ink-50 rounded-lg text-muted transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-risk-500" />
            </button>
            <button className="p-2 hover:bg-ink-50 rounded-lg text-muted transition-colors" title="快捷键 (?)">
              <Command className="w-4 h-4" />
            </button>
          </div>
          {/* 演示环境标识 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warn-50 text-warn-700 rounded-lg text-[10px] font-medium border border-warn-200">
            <span className="w-1.5 h-1.5 rounded-full bg-warn-500" />
            演示环境
          </div>
        </header>

        {/* 内容 */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background to-ink-50/30">
          {children}
        </main>
      </div>
    </div>
  );
}
