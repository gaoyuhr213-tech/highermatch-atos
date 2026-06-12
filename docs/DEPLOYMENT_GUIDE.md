# 蓉才通™ HigherMatch ATOS 部署指南

**版本**: v3.0  
**技术栈**: React 19 + TypeScript + Vite + TailwindCSS + Framer Motion

---

## 1. 环境要求

| 依赖 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.0 | 20.x LTS |
| pnpm | 8.0 | 9.x |
| 浏览器 | Chrome 90+ | Chrome 120+ |

---

## 2. 本地开发

```bash
# 克隆仓库
git clone https://github.com/perception-sequence/highermatch-pc.git
cd highermatch-pc

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:5173
```

**环境变量配置**（`.env.local`）：

```env
VITE_TRUST_MODE=mock
VITE_API_BASE_URL=http://localhost:3000
VITE_CA_GATEWAY_URL=http://localhost:3001/mock-ca
```

---

## 3. 生产构建

```bash
# 构建生产包
pnpm build

# 预览构建结果
pnpm preview

# 输出目录: dist/
```

构建产物结构：

```
dist/
├── index.html          (入口文件)
├── assets/
│   ├── index-*.css     (样式文件, ~45KB gzip ~8KB)
│   └── index-*.js      (脚本文件, ~900KB gzip ~248KB)
```

---

## 4. 部署方式

### 4.1 Vercel部署（推荐）

```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

`vercel.json` 配置：

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4.2 Netlify部署

`netlify.toml` 配置：

```toml
[build]
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 4.3 Nginx部署（政企内网推荐）

```nginx
server {
    listen 443 ssl http2;
    server_name atos.highermatch.cn;

    ssl_certificate     /etc/ssl/certs/highermatch.pem;
    ssl_certificate_key /etc/ssl/private/highermatch.key;
    ssl_protocols       TLSv1.3;

    root /var/www/highermatch-pc/dist;
    index index.html;

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;" always;
}
```

### 4.4 OSS/CDN部署（阿里云）

```bash
# 安装ossutil
pip install oss2

# 上传至OSS
ossutil cp -r dist/ oss://highermatch-atos/pc/ --acl public-read

# 配置CDN回源
# 域名: atos.highermatch.cn → OSS Bucket
# 回源协议: HTTPS
# 缓存规则: HTML 60s, JS/CSS 365d
```

---

## 5. 环境变量说明

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `VITE_TRUST_MODE` | 是 | 信任模式 | `mock` / `production` |
| `VITE_CA_GATEWAY_URL` | 生产必填 | CA网关地址 | `https://ca-gateway.scca.com.cn` |
| `VITE_CA_APP_ID` | 生产必填 | CA应用ID | `highermatch_atos_prod` |
| `VITE_CA_APP_SECRET` | 生产必填 | CA应用密钥 | `<由四川CA分配>` |
| `VITE_API_BASE_URL` | 是 | 后端API地址 | `https://api.highermatch.cn` |

---

## 6. 运维检查清单

| 检查项 | 频率 | 工具 |
|--------|------|------|
| HTTPS证书有效期 | 每月 | certbot / 阿里云证书 |
| 构建产物完整性 | 每次部署 | SHA256校验 |
| CSP策略有效性 | 每周 | Chrome DevTools |
| 性能基线 | 每周 | Lighthouse CI |
| 错误监控 | 实时 | Sentry |
| 访问日志审计 | 每日 | ELK / 阿里云日志 |

---

## 7. 故障排查

| 现象 | 可能原因 | 解决方案 |
|------|----------|----------|
| 白屏 | JS加载失败 | 检查CDN回源、CSP策略 |
| 路由404 | 未配置SPA回退 | 添加rewrite规则 |
| U盾无响应 | 驱动未安装 | 引导安装CA驱动 |
| 样式错乱 | CSS缓存 | 清除CDN缓存 |
| API超时 | 网络/后端异常 | 检查网关健康状态 |
