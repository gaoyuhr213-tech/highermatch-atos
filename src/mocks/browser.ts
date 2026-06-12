/**
 * HigherMatch ATOS — MSW Browser Worker
 * 
 * 浏览器端Service Worker配置。
 * 仅在开发环境启动，拦截所有/api/v1/*请求。
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
