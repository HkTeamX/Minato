FROM oven/bun:latest

WORKDIR /app

# 先复制依赖清单，尽量利用 Docker 层缓存
COPY package.json ./

RUN bun install

COPY src /app/src

ENV NODE_ENV=production

CMD ["bun", "run", "start"]