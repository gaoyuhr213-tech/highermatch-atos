import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; showDetails: boolean; retryCount: number; }

// DOM操作错误关键词（通常由浏览器扩展注入DOM导致）
const DOM_ERROR_PATTERNS = ['insertBefore', 'removeChild', 'appendChild', 'replaceChild', 'not a child'];
function isDOMConflictError(error: Error): boolean {
  const msg = error.message || '';
  return DOM_ERROR_PATTERNS.some(p => msg.includes(p));
}
const MAX_AUTO_RETRY = 2;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, showDetails: false, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
    // 对DOM冲突错误自动重试（浏览器扩展导致）
    if (isDOMConflictError(error) && this.state.retryCount < MAX_AUTO_RETRY) {
      console.warn(`[ErrorBoundary] DOM冲突错误，自动重试 (${this.state.retryCount + 1}/${MAX_AUTO_RETRY})`);
      setTimeout(() => {
        this.setState(s => ({ hasError: false, error: null, errorInfo: null, retryCount: s.retryCount + 1 }));
      }, 100);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false, retryCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-900 p-8">
          <div className="max-w-lg w-full bg-surface dark:bg-ink-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">系统异常</h2>
            <p className="text-sm text-muted dark:text-muted mb-6">页面渲染遇到错误，请尝试刷新或联系管理员</p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">重试</button>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-ink-200 dark:bg-ink-700 text-foreground dark:text-ink-200 rounded-lg text-sm font-medium hover:bg-ink-300 dark:hover:bg-ink-600 transition-colors">刷新页面</button>
            </div>
            {this.state.error && (
              <div className="mt-6 text-left">
                <button onClick={() => this.setState(s => ({ ...s, showDetails: !s.showDetails }))} className="text-xs text-muted hover:text-muted underline">
                  {this.state.showDetails ? '收起详情' : '展开错误详情'}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 p-3 bg-ink-100 dark:bg-ink-900 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                    {this.state.error.message}{'\n'}{this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
