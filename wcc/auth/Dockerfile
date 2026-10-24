FROM node:22-bookworm-slim
WORKDIR /app
COPY wcc/auth/package*.json ./
RUN npm ci --omit=dev
COPY wcc/auth/*.js ./
COPY wcc/web/menu_config.js ./
COPY gateway/nginx.conf ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
