/**
 * 蓉才通™ ATOS 统一状态管理
 * 
 * 使用 useReducer + Context 实现集中式状态管理
 * 替代分散的 useState，确保状态流闭环、可追溯
 */

import { createContext, useContext, type Dispatch } from 'react';

// ─── 角色类型 ────────────────────────────────────────────
export type Role = 'employer' | 'candidate' | 'expert' | 'soe';

// ─── 状态定义 ────────────────────────────────────────────
export interface AppState {
  authenticated: boolean;
  role: Role;
  showLineage: boolean;
  lineageTarget: string | null;
  tenantId: string | null;
  enterpriseName: string | null;
  certSerial: string | null;
  certLevel: 'EV' | 'OV' | 'DV' | null;
  scopedToken: string | null;
  sidebarCollapsed: boolean;
}

// ─── Action定义 ──────────────────────────────────────────
export type AppAction =
  | { type: 'LOGIN_SUCCESS'; payload: { role: Role; tenantId: string; enterpriseName: string; certSerial: string; certLevel: 'EV' | 'OV' | 'DV'; scopedToken: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_ROLE'; payload: Role }
  | { type: 'OPEN_LINEAGE'; payload: string }
  | { type: 'CLOSE_LINEAGE' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean };

// ─── 初始状态 ────────────────────────────────────────────
export const initialState: AppState = {
  authenticated: false,
  role: 'employer',
  showLineage: false,
  lineageTarget: null,
  tenantId: null,
  enterpriseName: null,
  certSerial: null,
  certLevel: null,
  scopedToken: null,
  sidebarCollapsed: false,
};

// ─── Reducer ─────────────────────────────────────────────
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        authenticated: true,
        role: action.payload.role,
        tenantId: action.payload.tenantId,
        enterpriseName: action.payload.enterpriseName,
        certSerial: action.payload.certSerial,
        certLevel: action.payload.certLevel,
        scopedToken: action.payload.scopedToken,
      };
    case 'LOGOUT':
      return { ...initialState };
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'OPEN_LINEAGE':
      return { ...state, showLineage: true, lineageTarget: action.payload };
    case 'CLOSE_LINEAGE':
      return { ...state, showLineage: false, lineageTarget: null };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.payload };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────
export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextValue>({
  state: initialState,
  dispatch: () => { throw new Error('AppContext not initialized'); },
});

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

// ─── 便捷Hooks ──────────────────────────────────────────
export function useAuth() {
  const { state, dispatch } = useAppContext();
  return {
    authenticated: state.authenticated,
    role: state.role,
    tenantId: state.tenantId,
    enterpriseName: state.enterpriseName,
    certSerial: state.certSerial,
    certLevel: state.certLevel,
    scopedToken: state.scopedToken,
    login: (payload: Extract<AppAction, { type: 'LOGIN_SUCCESS' }>['payload']) =>
      dispatch({ type: 'LOGIN_SUCCESS', payload }),
    logout: () => dispatch({ type: 'LOGOUT' }),
    setRole: (role: Role) => dispatch({ type: 'SET_ROLE', payload: role }),
  };
}
