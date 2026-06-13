import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function bootstrap() {
  // 启动MSW mock server（当前无真实后端，所有环境均需要）
  try {
    const { initMocks } = await import('./mocks');
    await initMocks();
  } catch (e) {
    console.warn('[MSW] Service Worker 启动失败，将使用降级模式:', e);
  }

  // 确保DOM完全就绪后再挂载React
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found');

  // 注意：移除StrictMode以避免React 19双重渲染与Service Worker DOM注入冲突
  // 错误表现：insertBefore - 要插入的新节点不是此节点的子节点
  createRoot(root).render(<App />);
}

bootstrap();
