FROM oven/bun:latest

# 安装 Puppeteer 所需的系统依赖
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# 设置环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# 设置工作目录
WORKDIR /app

# 从构建阶段复制必要的文件
COPY . .

# 递归赋予 /app 及其所有子文件/文件夹给 bun 用户
RUN chmod -R 777 /app
RUN chown -R bun:bun /app

# 切换到 bun 用户
USER bun

# 执行 bun install 安装依赖
RUN bun install --frozen-lockfile

# 创建数据和配置目录
RUN mkdir -p /app/src/data /app/src/config

# 定义卷挂载点
VOLUME ["/app/src/data", "/app/src/config"]

# 启动应用
CMD ["bun", "start"]
