/**
 * HigherMatch ATOS — Authentication Context
 * 
 * 完整认证体系：
 * - JWT双Token机制（access + refresh）
 * - RBAC角色权限控制
 * - Session生命周期管理
 * - U盾Challenge-Response认证流程
 * - 自动Token刷新
 * - 会话过期处理
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import type { User, UserRole, AuthTokens, LoginRequest, UShieldChallenge } from '../api/types';
import { authService } from '../api/services';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'export' | 'approve')[];
}

export interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: User | null;
  permissions: Permission[];
  error: string | null;
  sessionExpiresAt: number | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; user: User; permissions: Permission[] }
  | { type: 'AUTH_FAILURE'; error: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SESSION_REFRESH'; expiresAt: number }
  | { type: 'USER_UPDATE'; user: Partial<User> };

interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<void>;
  loginWithUShield: (certSN: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  isCAVerified: () => boolean;
}

// ─── RBAC Permission Matrix ──────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete', 'export', 'approve'] },
  ],
  hr_manager: [
    { resource: 'jobs', actions: ['create', 'read', 'update', 'delete', 'approve'] },
    { resource: 'applications', actions: ['create', 'read', 'update', 'export', 'approve'] },
    { resource: 'interviews', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'candidates', actions: ['read', 'update', 'export'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'audit', actions: ['read', 'export'] },
    { resource: 'community', actions: ['create', 'read', 'update', 'approve'] },
    { resource: 'enterprise', actions: ['read', 'update'] },
    { resource: 'trust', actions: ['read'] },
  ],
  hr_specialist: [
    { resource: 'jobs', actions: ['create', 'read', 'update'] },
    { resource: 'applications', actions: ['read', 'update'] },
    { resource: 'interviews', actions: ['create', 'read', 'update'] },
    { resource: 'candidates', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'community', actions: ['create', 'read'] },
    { resource: 'trust', actions: ['read'] },
  ],
  interviewer: [
    { resource: 'interviews', actions: ['read', 'update'] },
    { resource: 'candidates', actions: ['read'] },
    { resource: 'applications', actions: ['read'] },
  ],
  candidate: [
    { resource: 'jobs', actions: ['read'] },
    { resource: 'applications', actions: ['create', 'read'] },
    { resource: 'community', actions: ['read'] },
  ],
  auditor: [
    { resource: 'audit', actions: ['read', 'export'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'trust', actions: ['read'] },
    { resource: 'enterprise', actions: ['read'] },
  ],
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  status: 'idle',
  user: null,
  permissions: [],
  error: null,
  sessionExpiresAt: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, status: 'loading', error: null };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        user: action.user,
        permissions: action.permissions,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        status: 'error',
        user: null,
        permissions: [],
        error: action.error,
      };
    case 'AUTH_LOGOUT':
      return { ...initialState, status: 'unauthenticated' };
    case 'SESSION_REFRESH':
      return { ...state, sessionExpiresAt: action.expiresAt };
    case 'USER_UPDATE':
      return state.user
        ? { ...state, user: { ...state.user, ...action.user } }
        : state;
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 初始化：检查已有Token ──────────────────────────────────────────────────

  useEffect(() => {
    const token = apiClient.getAccessToken();
    if (token) {
      initializeSession();
    } else {
      dispatch({ type: 'AUTH_LOGOUT' });
    }

    // 监听session过期事件
    const handleSessionExpired = () => {
      dispatch({ type: 'AUTH_LOGOUT' });
      window.location.href = '/login';
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ── 初始化Session ─────────────────────────────────────────────────────────

  const initializeSession = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authService.getCurrentUser();
      const user = res.data;
      const permissions = ROLE_PERMISSIONS[user.role] || [];
      dispatch({ type: 'AUTH_SUCCESS', user, permissions });
      scheduleTokenRefresh();
    } catch {
      apiClient.clearAuth();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  // ── Token自动刷新 ──────────────────────────────────────────────────────────

  const scheduleTokenRefresh = useCallback(() => {
    const token = apiClient.getAccessToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - 2 * 60 * 1000; // 提前2分钟刷新
      const delay = Math.max(refreshAt - Date.now(), 10_000);

      dispatch({ type: 'SESSION_REFRESH', expiresAt });

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          await refreshSession();
          scheduleTokenRefresh();
        } catch {
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      }, delay);
    } catch {
      // Token格式异常
    }
  }, []);

  // ── 登录 ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (req: LoginRequest) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authService.login(req);
      const { accessToken, refreshToken, user } = res.data;
      apiClient.setTokens(accessToken, refreshToken);
      
      const permissions = ROLE_PERMISSIONS[user.role] || [];
      dispatch({ type: 'AUTH_SUCCESS', user, permissions });
      scheduleTokenRefresh();
    } catch (err: any) {
      const message = err?.message || '登录失败，请重试';
      dispatch({ type: 'AUTH_FAILURE', error: message });
      throw err;
    }
  }, [scheduleTokenRefresh]);

  // ── U盾登录（Challenge-Response） ─────────────────────────────────────────

  const loginWithUShield = useCallback(async (certSN: string, pin: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      // Step 1: 获取挑战码
      const challengeRes = await authService.getUShieldChallenge();
      const challenge = challengeRes.data;

      // Step 2: 使用U盾签名（通过WebUSB/本地Agent）
      const signature = await signChallengeWithUShield(certSN, pin, challenge);

      // Step 3: 提交签名验证
      const loginRes = await authService.login({
        type: 'ushield',
        certSN,
        signature,
        challenge: challenge.challengeId,
      });

      const { accessToken, refreshToken, user } = loginRes.data;
      apiClient.setTokens(accessToken, refreshToken);
      
      const permissions = ROLE_PERMISSIONS[user.role] || [];
      dispatch({ type: 'AUTH_SUCCESS', user, permissions });
      scheduleTokenRefresh();
    } catch (err: any) {
      const message = err?.message || 'U盾认证失败';
      dispatch({ type: 'AUTH_FAILURE', error: message });
      throw err;
    }
  }, [scheduleTokenRefresh]);

  // ── 登出 ──────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // 即使服务端登出失败也清除本地状态
    } finally {
      apiClient.clearAuth();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  // ── 刷新Session ───────────────────────────────────────────────────────────

  const refreshSession = useCallback(async () => {
    const refreshToken = localStorage.getItem('hm_refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const res = await authService.refresh(refreshToken);
    const { accessToken, refreshToken: newRefresh } = res.data;
    apiClient.setTokens(accessToken, newRefresh);
  }, []);

  // ── 权限检查 ──────────────────────────────────────────────────────────────

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    return state.permissions.some(
      (p) =>
        (p.resource === '*' || p.resource === resource) &&
        p.actions.includes(action as any)
    );
  }, [state.permissions]);

  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  const isCAVerified = useCallback((): boolean => {
    return state.user?.caVerified ?? false;
  }, [state.user]);

  // ── Context Value ─────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    ...state,
    login,
    loginWithUShield,
    logout,
    refreshSession,
    hasPermission,
    hasRole,
    isCAVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── U盾签名辅助函数 ─────────────────────────────────────────────────────────

async function signChallengeWithUShield(
  certSN: string,
  pin: string,
  challenge: UShieldChallenge
): Promise<string> {
  /**
   * 生产环境：通过WebUSB API或本地Agent与U盾硬件通信
   * 
   * 流程：
   * 1. 连接U盾设备（WebUSB / localhost Agent）
   * 2. 验证PIN码
   * 3. 使用SM2私钥对challenge.nonce签名
   * 4. 返回DER编码的签名
   * 
   * 当前实现：调用本地Agent HTTP接口
   */
  const AGENT_URL = import.meta.env.VITE_USHIELD_AGENT_URL || 'http://127.0.0.1:19876';
  
  try {
    const response = await fetch(`${AGENT_URL}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certSN,
        pin,
        data: challenge.nonce,
        algorithm: 'SM2withSM3',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('PIN码错误');
      if (response.status === 423) throw new Error('U盾已锁定，请联系CA中心解锁');
      if (response.status === 404) throw new Error('未检测到U盾设备');
      throw new Error(err.message || 'U盾签名失败');
    }

    const result = await response.json();
    return result.signature;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('未检测到U盾驱动程序，请确认已安装并启动U盾助手');
    }
    throw err;
  }
}

// ─── Route Guard Component ───────────────────────────────────────────────────

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  requiredPermission?: { resource: string; action: string };
  fallback?: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiredRoles,
  requiredPermission,
  fallback,
}) => {
  const { status, hasRole, hasPermission } = useAuth();

  if (status === 'loading' || status === 'idle') {
    return <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>;
  }

  if (status !== 'authenticated') {
    window.location.href = '/login';
    return null;
  }

  if (requiredRoles && !hasRole(...requiredRoles)) {
    return fallback ? <>{fallback}</> : (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="text-lg font-medium">权限不足</p>
        <p className="text-sm mt-1">您没有访问此页面的权限</p>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return fallback ? <>{fallback}</> : (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <p className="text-lg font-medium">操作受限</p>
        <p className="text-sm mt-1">您没有执行此操作的权限</p>
      </div>
    );
  }

  return <>{children}</>;
};
