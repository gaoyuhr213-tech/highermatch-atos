/**
 * HigherMatch ATOS — MSW Initialization
 * 
 * 条件启动：仅在开发环境且VITE_ENABLE_MSW=true时激活。
 * 生产环境此模块不会被打包（tree-shaking）。
 */

export async function initMocks(): Promise<void> {
  if (import.meta.env.PROD) return;
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return;

  const { worker } = await import('./browser');
  
  await worker.start({
    onUnhandledRequest: 'bypass', // 未匹配的请求直接放行
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });

  console.log('[MSW] Mock Service Worker 已启动');
  console.log('[MSW] 拦截 API 端点: /api/v1/*');
}
