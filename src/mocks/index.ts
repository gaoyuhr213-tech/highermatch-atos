/**
 * HigherMatch ATOS — MSW Initialization
 * 
 * 在所有环境启动MSW mock server。
 * 当前阶段无真实后端，MSW作为唯一数据源。
 * 后续接入真实API后，可改回仅开发环境启动。
 */

export async function initMocks(): Promise<void> {
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
