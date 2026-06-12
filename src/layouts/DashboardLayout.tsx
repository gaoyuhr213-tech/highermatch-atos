import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GitBranch, Network, Search, Video, Bot, Send, Award, Star, Gift, Users, Building2, Shield, LogOut, ChevronDown, Fingerprint, MessageSquare, BarChart3, FileText, Compass } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import type { Role } from '../App';

interface Props { children: ReactNode; }

const roleConfig: Record<Role, { label: string; icon: typeof Building2; color: string; nav: { path: string; label: string; icon: typeof LayoutDashboard }[] }> = {
  employer: { label: 'B端 · 雇主/HRD', icon: Building2, color: 'text-primary-600', nav: [
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
  candidate: { label: 'C端 · 候选人', icon: Users, color: 'text-emerald-600', nav: [
    { path: '/c/coach', label: 'AI 职业教练', icon: Bot },
    { path: '/c/apply', label: '智能投递', icon: Send },
    { path: '/c/endorsement', label: '背书卡片', icon: Award },
    { path: '/c/decision-hub', label: '决策社区', icon: Compass },
  ]},
  expert: { label: '专家端 · 评审', icon: Star, color: 'text-amber-600', nav: [
    { path: '/expert/reviews', label: '评审任务', icon: Star },
    { path: '/expert/rewards', label: '积分奖励', icon: Gift },
  ]},
  soe: { label: '国企端 · 组织', icon: Building2, color: 'text-violet-600', nav: [
    { path: '/soe/succession', label: '继任沙盘', icon: Users },
    { path: '/soe/commons', label: '人才共享', icon: Network },
  ]},
};

const roles: Role[] = ['employer', 'candidate', 'expert', 'soe'];

export default function DashboardLayout({ children }: Props) {
  const { role, setRole, setAuthenticated, setShowLineage } = useApp();
  const [roleDropdown, setRoleDropdown] = useState(false);
  const navigate = useNavigate();
  const config = roleConfig[role];

  const handleSwitch = (r: Role) => { setRole(r); setRoleDropdown(false); navigate(roleConfig[r].nav[0].path); };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-[260px] flex flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-xl">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">蓉才通™</h1>
              <p className="text-[10px] text-slate-400 font-medium">HigherMatch ATOS · 四川CA</p>
            </div>
          </div>
        </div>
        {/* Role Switcher */}
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="relative">
            <button onClick={() => setRoleDropdown(!roleDropdown)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <config.icon className={`w-4 h-4 ${config.color}`} />
              <span className="text-sm font-medium text-slate-700 flex-1 text-left">{config.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${roleDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {roleDropdown && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                  {roles.map(r => (
                    <button key={r} onClick={() => handleSwitch(r)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors ${r === role ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600'}`}>
                      {(() => { const Icon = roleConfig[r].icon; return <Icon className="w-4 h-4" />; })()}
                      <span>{roleConfig[r].label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">功能导航</p>
          {config.nav.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}>
              <item.icon className="w-4 h-4" /><span>{item.label}</span>
            </NavLink>
          ))}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">快捷操作</p>
            <button onClick={() => setShowLineage(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all">
              <Fingerprint className="w-4 h-4" /><span>决策血统追溯</span>
            </button>
          </div>
        </nav>
        {/* User */}
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">管</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">管理员</p>
              <p className="text-[10px] text-slate-400">四川CA · U盾认证</p>
            </div>
            <button onClick={() => setAuthenticated(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="退出登录">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100/50">{children}</main>
    </div>
  );
}
