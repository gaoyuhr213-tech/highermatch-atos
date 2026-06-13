import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useReducer, lazy, Suspense, useState, useEffect } from 'react';
import { AppContext, appReducer, initialState, useAppContext } from './store';
import type { Role } from './store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingView } from './components/StateViews';
import { QueryProvider } from './lib/api/provider';
import { AuthProvider } from './lib/auth';
import { TrustedSessionProvider } from './lib/trust/TrustedSessionProvider';
import { useTrustedSession } from './lib/trust/session';
import DashboardLayout from './layouts/DashboardLayout';

// ─── 路由级 Code Split（React.lazy） ─────────────────────
const CertAssistant = lazy(() => import('./pages/CertAssistant'));
const EndorsementVerify = lazy(() => import('./pages/public/EndorsementVerify'));
const CommandCenter = lazy(() => import('./pages/b/CommandCenter'));
const Pipeline = lazy(() => import('./pages/b/Pipeline'));
const Graph = lazy(() => import('./pages/b/Graph'));
const Sourcing = lazy(() => import('./pages/b/Sourcing'));
const Interview = lazy(() => import('./pages/b/Interview'));
const JobQA = lazy(() => import('./pages/b/JobQA'));
const Community = lazy(() => import('./pages/b/Community'));
const EfficiencyDashboard = lazy(() => import('./pages/b/EfficiencyDashboard'));
const AuditLog = lazy(() => import('./pages/b/AuditLog'));
const Coach = lazy(() => import('./pages/c/Coach'));
const DecisionHub = lazy(() => import('./pages/c/DecisionHub'));
const Apply = lazy(() => import('./pages/c/Apply'));
const Endorsement = lazy(() => import('./pages/c/Endorsement'));
const Reviews = lazy(() => import('./pages/expert/Reviews'));
const Rewards = lazy(() => import('./pages/expert/Rewards'));
const Succession = lazy(() => import('./pages/soe/Succession'));
const Commons = lazy(() => import('./pages/soe/Commons'));
const DecisionLineage = lazy(() => import('./pages/DecisionLineage'));
const ResumeIntelligence = lazy(() => import('./pages/b/ResumeIntelligence'));
const PeopleGPT = lazy(() => import('./pages/b/PeopleGPT'));
const CandidateCopilot = lazy(() => import('./pages/c/CandidateCopilot'));
import { CommandPalette } from './components/CommandPalette';

// ─── 兼容旧API（供子组件过渡期使用） ────────────────────
export type { Role } from './store';
export { AppContext } from './store';
export const useApp = () => {
  const { state, dispatch } = useAppContext();
  return {
    authenticated: state.authenticated,
    role: state.role,
    setAuthenticated: (v: boolean) => {
      if (v) dispatch({ type: 'LOGIN_SUCCESS', payload: { role: 'employer' as Role, tenantId: 'demo', enterpriseName: '蓉才通演示', certSerial: 'SCCA-DEMO-001', certLevel: 'EV', scopedToken: 'demo-token' } });
      else dispatch({ type: 'LOGOUT' });
    },
    setRole: (r: Role) => dispatch({ type: 'SET_ROLE', payload: r }),
    showLineage: state.showLineage,
    setShowLineage: (v: boolean) => {
      if (v) dispatch({ type: 'OPEN_LINEAGE', payload: '' });
      else dispatch({ type: 'CLOSE_LINEAGE' });
    },
  };
};

/**
 * 内部路由容器
 * 根据TrustedSession状态决定展示入场流还是Dashboard
 */
function AppRoutes() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { isAuthenticated: isTrusted } = useTrustedSession();
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 入场流完成后同步到旧状态管理（兼容）
  // 当TrustedSession有身份但旧state未认证时，自动同步
  if (isTrusted && !state.authenticated) {
    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: {
        role: 'employer' as Role,
        tenantId: 'demo',
        enterpriseName: '蓉才通演示',
        certSerial: 'SCCA-DEMO-001',
        certLevel: 'EV',
        scopedToken: 'demo-token',
      },
    });
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <BrowserRouter>
        <Suspense fallback={<LoadingView text="正在加载页面..." />}>
          <Routes>
            {/* 公开路由（无需认证） */}
            <Route path="/e/:slug" element={<EndorsementVerify />} />

            {/* 入场流 or Dashboard */}
            <Route path="/*" element={
              !state.authenticated ? (
                <CertAssistant key="cert-assistant" />
              ) : (
                <DashboardLayout key="dashboard">
                  <Routes>
                    {/* B端 */}
                    <Route path="/b/command" element={<CommandCenter />} />
                    <Route path="/b/pipeline" element={<Pipeline />} />
                    <Route path="/b/graph" element={<Graph />} />
                    <Route path="/b/sourcing" element={<Sourcing />} />
                    <Route path="/b/interview" element={<Interview />} />
                    <Route path="/b/job-qa" element={<JobQA />} />
                    <Route path="/b/community" element={<Community />} />
                    <Route path="/b/efficiency" element={<EfficiencyDashboard />} />
                    <Route path="/b/audit" element={<AuditLog />} />
                    <Route path="/b/resume-intelligence" element={<ResumeIntelligence />} />
                    <Route path="/b/people-gpt" element={<PeopleGPT />} />
                    {/* C端 */}
                    <Route path="/c/coach" element={<Coach />} />
                    <Route path="/c/apply" element={<Apply />} />
                    <Route path="/c/endorsement" element={<Endorsement />} />
                    <Route path="/c/copilot" element={<CandidateCopilot />} />
                    <Route path="/c/decision-hub" element={<DecisionHub />} />
                    {/* 专家端 */}
                    <Route path="/expert/reviews" element={<Reviews />} />
                    <Route path="/expert/rewards" element={<Rewards />} />
                    {/* 国企端 */}
                    <Route path="/soe/succession" element={<Succession />} />
                    <Route path="/soe/commons" element={<Commons />} />
                    {/* 默认重定向 */}
                    <Route path="*" element={<Navigate to="/b/command" replace />} />
                  </Routes>
                  {state.showLineage && (
                    <DecisionLineage onClose={() => dispatch({ type: 'CLOSE_LINEAGE' })} decisionId={state.lineageTarget || 'default'} />
                  )}
                  <CommandPalette
                    open={cmdOpen}
                    onClose={() => setCmdOpen(false)}
                    onLineage={() => dispatch({ type: 'OPEN_LINEAGE', payload: '' })}
                  />
                </DashboardLayout>
              )
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <TrustedSessionProvider>
            <AppRoutes />
          </TrustedSessionProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
