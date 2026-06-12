FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx vite build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S atos && adduser -S atos -u 1001
USER atos
COPY --from=frontend-build --chown=atos:atos /app/dist ./dist
COPY --from=frontend-build --chown=atos:atos /app/server ./server
COPY --from=frontend-build --chown=atos:atos /app/node_modules ./node_modules
COPY --chown=atos:atos package.json ./
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1
CMD ["node", "server/index.js"]
