/**
 * HigherMatch ATOS — Query Provider
 * 
 * React Query全局配置：
 * - 错误重试策略
 * - 缓存时间
 * - 全局错误处理
 * - DevTools（开发环境）
 */

import React from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import type { ApiError } from './client';

// 全局错误处理
const handleGlobalError = (error: unknown) => {
  const apiError = error as ApiError;
  
  // 401 → 跳转登录
  if (apiError?.code === 401) {
    // 由 auth:session-expired 事件处理
    return;
  }

  // 403 → 权限不足
  if (apiError?.code === 403) {
    console.error('[权限不足]', apiError.message);
    return;
  }

  // 500+ → 服务端错误
  if (apiError?.code >= 500) {
    console.error('[服务端错误]', apiError.message, apiError.requestId);
  }
};

// QueryClient 单例
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s
      gcTime: 5 * 60_000, // 5min garbage collection
      retry: (failureCount, error) => {
        const apiError = error as ApiError;
        // 不重试4xx错误
        if (apiError?.code >= 400 && apiError?.code < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// Provider组件
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
