# 蓉才通™ PC端原型 — 部署指南

## 方式一：Vercel 自动部署（推荐）

1. 访问 https://vercel.com/new
2. 点击 "Import Git Repository"
3. 选择 `gaoyuhr213-tech/highermatch-atos`
4. 配置：
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 点击 Deploy

> 部署完成后获得永久链接（如 `highermatch-atos.vercel.app`），每次push自动重新部署。

---

## 方式二：Netlify 自动部署

1. 访问 https://app.netlify.com/start
2. 连接 GitHub → 选择 `gaoyuhr213-tech/highermatch-atos`
3. 配置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 点击 Deploy site

> 项目已包含 `netlify.toml` 配置文件，无需额外设置。

---

## 方式三：本地预览

```bash
git clone https://github.com/gaoyuhr213-tech/highermatch-atos.git
cd highermatch-atos
npm install
npm run dev        # 开发模式 http://localhost:5173
npm run build      # 构建生产版本
npm run preview    # 预览构建结果 http://localhost:4173
```

---

## 方式四：静态文件部署（阿里云OSS/腾讯云COS）

```bash
npm run build
# 将 dist/ 目录内容上传至OSS/COS
# 配置SPA路由：所有404重定向到 index.html
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1 | UI框架 |
| TypeScript | 5.9 | 类型安全 |
| Vite | 8.0 | 构建工具 |
| TailwindCSS | 3.4 | 样式系统 |
| @dnd-kit | 6.3 | 拖拽交互 |
| Lucide React | 0.511 | 图标库 |
| Framer Motion | 12.12 | 动画 |
| React Router | 7.6 | 路由 |

---

## 环境要求

- Node.js ≥ 18
- npm ≥ 9 或 pnpm ≥ 8
- 现代浏览器（Chrome 90+, Firefox 90+, Safari 15+, Edge 90+）
- 推荐分辨率：1920×1080

---

## 演示路径

1. 打开应用 → U盾登录流程自动启动
2. 等待"设备检测"完成 → 输入任意6位PIN码 → 点击验证
3. 观察SM2签名+CA鉴权动画 → 自动跳转总控台
4. 侧边栏导航切换功能模块
5. 顶部下拉框切换角色端（B端/C端/专家端/国企端）
6. 快捷键：`Ctrl+L`决策血统 | `Ctrl+E`导出 | `?`快捷键面板
