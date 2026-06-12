import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function bootstrap() {
  // 启动MSW mock server（当前无真实后端，所有环境均需要）
  const { initMocks } = await import('./mocks');
  await initMocks();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
