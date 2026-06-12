/**
 * HigherMatch ATOS — API Layer
 * 
 * 统一导出：
 * - apiClient: HTTP客户端实例
 * - services: 按领域组织的API调用
 * - hooks: React Query hooks
 * - types: 类型定义
 * - QueryProvider: React Query Provider
 */

export { apiClient, ApiClient } from './client';
export type { ApiConfig, ApiResponse, ApiError, RequestConfig } from './client';

export * from './types';
export * from './services';
export * from './hooks';
export { QueryProvider, queryClient } from './provider';
