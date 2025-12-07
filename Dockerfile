FROM oven/bun:latest

# 安装 Puppeteer 所需的系统依赖
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    # 中文字体
    fonts-wqy-microhei \
    fonts-wqy-zenhei \
    language-pack-zh-hans \
    && rm -rf /var/lib/apt/lists/*

RUN dpkg-reconfigure fontconfig

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
