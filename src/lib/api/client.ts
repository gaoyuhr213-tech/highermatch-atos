/**
 * HigherMatch ATOS — Production API Client
 * 
 * 统一HTTP客户端，支持：
 * - 类型安全的请求/响应
 * - JWT自动刷新（双Token机制）
 * - 请求/响应拦截器
 * - 重试机制（指数退避）
 * - 请求取消（AbortController）
 * - 租户隔离Header注入
 * - 全链路请求ID追踪
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
  requestId: string;
  timestamp: number;
}

export interface ApiError {
  code: number;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retry?: number;
  retryDelay?: number;
  skipAuth?: boolean;
}

type Interceptor<T> = (config: T) => T | Promise<T>;

// ─── Token Storage ───────────────────────────────────────────────────────────

class TokenManager {
  private static ACCESS_KEY = 'hm_access_token';
  private static REFRESH_KEY = 'hm_refresh_token';
  private static TENANT_KEY = 'hm_tenant_id';
  private refreshPromise: Promise<string> | null = null;

  getAccessToken(): string | null {
    return localStorage.getItem(TokenManager.ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(TokenManager.REFRESH_KEY);
  }

  getTenantId(): string | null {
    return localStorage.getItem(TokenManager.TENANT_KEY);
  }

  setTokens(access: string, refresh: string): void {
    localStorage.setItem(TokenManager.ACCESS_KEY, access);
    localStorage.setItem(TokenManager.REFRESH_KEY, refresh);
  }

  setTenantId(tenantId: string): void {
    localStorage.setItem(TokenManager.TENANT_KEY, tenantId);
  }

  clearTokens(): void {
    localStorage.removeItem(TokenManager.ACCESS_KEY);
    localStorage.removeItem(TokenManager.REFRESH_KEY);
    localStorage.removeItem(TokenManager.TENANT_KEY);
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // 提前60秒判定过期
      return payload.exp * 1000 < Date.now() + 60_000;
    } catch {
      return true;
    }
  }

  async refreshAccessToken(refreshFn: () => Promise<{ accessToken: string; refreshToken: string }>): Promise<string> {
    // 防止并发刷新
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const { accessToken, refreshToken } = await refreshFn();
        this.setTokens(accessToken, refreshToken);
        return accessToken;
      } catch (err) {
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        throw err;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

// ─── API Client ──────────────────────────────────────────────────────────────

export class ApiClient {
  private config: Required<ApiConfig>;
  private tokenManager = new TokenManager();
  private requestInterceptors: Interceptor<RequestConfig>[] = [];
  private responseInterceptors: Interceptor<ApiResponse>[] = [];

  constructor(config: ApiConfig) {
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30_000,
      headers: config.headers ?? {},
    };
  }

  // ─── Interceptors ──────────────────────────────────────────────────────────

  onRequest(interceptor: Interceptor<RequestConfig>): void {
    this.requestInterceptors.push(interceptor);
  }

  onResponse(interceptor: Interceptor<ApiResponse>): void {
    this.responseInterceptors.push(interceptor);
  }

  // ─── Token Management ──────────────────────────────────────────────────────

  setTokens(access: string, refresh: string): void {
    this.tokenManager.setTokens(access, refresh);
  }

  setTenantId(tenantId: string): void {
    this.tokenManager.setTenantId(tenantId);
  }

  clearAuth(): void {
    this.tokenManager.clearTokens();
  }

  getAccessToken(): string | null {
    return this.tokenManager.getAccessToken();
  }

  // ─── Core Request ──────────────────────────────────────────────────────────

  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    // Apply request interceptors
    let finalConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    // Build URL
    let url = `${this.config.baseURL}${finalConfig.url}`;
    if (finalConfig.params) {
      const searchParams = new URLSearchParams();
      Object.entries(finalConfig.params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.append(key, String(val));
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateRequestId(),
      ...this.config.headers,
      ...finalConfig.headers,
    };

    // Auth header
    if (!finalConfig.skipAuth) {
      const token = this.tokenManager.getAccessToken();
      if (token) {
        // Auto-refresh if expired
        if (this.tokenManager.isTokenExpired(token)) {
          const refreshToken = this.tokenManager.getRefreshToken();
          if (refreshToken) {
            try {
              const newToken = await this.tokenManager.refreshAccessToken(async () => {
                const res = await fetch(`${this.config.baseURL}/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken }),
                });
                if (!res.ok) throw new Error('Refresh failed');
                return res.json();
              });
              headers['Authorization'] = `Bearer ${newToken}`;
            } catch {
              // Session expired, will be handled by event listener
              throw { code: 401, message: '会话已过期，请重新登录', requestId: headers['X-Request-ID'] } as ApiError;
            }
          }
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }

    // Tenant header
    const tenantId = this.tokenManager.getTenantId();
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // Execute with retry
    const maxRetries = finalConfig.retry ?? 0;
    const baseDelay = finalConfig.retryDelay ?? 1000;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        const signal = finalConfig.signal
          ? this.mergeAbortSignals(finalConfig.signal, controller.signal)
          : controller.signal;

        const response = await fetch(url, {
          method: finalConfig.method,
          headers,
          body: finalConfig.data ? JSON.stringify(finalConfig.data) : undefined,
          signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const apiError: ApiError = {
            code: response.status,
            message: errorBody.message || response.statusText,
            details: errorBody.details,
            requestId: headers['X-Request-ID'],
          };

          // 401 → session expired
          if (response.status === 401) {
            this.tokenManager.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:session-expired'));
          }

          throw apiError;
        }

        let result: ApiResponse<T> = await response.json();

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          result = await interceptor(result) as ApiResponse<T>;
        }

        return result;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && this.isRetryable(err)) {
          await this.sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  // ─── Convenience Methods ───────────────────────────────────────────────────

  get<T>(url: string, params?: Record<string, string | number | boolean | undefined>, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', url, params, ...config });
  }

  post<T>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  put<T>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  patch<T>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  delete<T>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    const apiErr = err as ApiError;
    if (apiErr.code && [401, 403, 404, 422].includes(apiErr.code)) return false;
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mergeAbortSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) { controller.abort(); return controller.signal; }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = new ApiClient({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

// Request logging interceptor (dev only)
if (import.meta.env.DEV) {
  apiClient.onRequest((config) => {
    console.debug(`[API] ${config.method} ${config.url}`, config.data || '');
    return config;
  });
}
