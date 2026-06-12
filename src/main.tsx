import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function bootstrap() {
  // 开发环境启动MSW（生产环境tree-shake掉）
  if (import.meta.env.DEV) {
    const { initMocks } = await import('./mocks');
    await initMocks();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
