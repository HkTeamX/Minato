FROM oven/bun:latest

# 安装 Puppeteer 所需的系统依赖
# RUN apt-get update && apt-get install -y \
#     chromium \
#     chromium-sandbox \
#     ca-certificates \
#     fonts-liberation \
#     libasound2 \
#     libatk-bridge2.0-0 \
#     libatk1.0-0 \
#     libc6 \
#     libcairo2 \
#     libcups2 \
#     libdbus-1-3 \
#     libexpat1 \
#     libfontconfig1 \
#     libgbm1 \
#     libgcc1 \
#     libglib2.0-0 \
#     libgtk-3-0 \
#     libnspr4 \
#     libnss3 \
#     libpango-1.0-0 \
#     libpangocairo-1.0-0 \
#     libstdc++6 \
#     libx11-6 \
#     libx11-xcb1 \
#     libxcb1 \
#     libxcomposite1 \
#     libxcursor1 \
#     libxdamage1 \
#     libxext6 \
#     libxfixes3 \
#     libxi6 \
#     libxrandr2 \
#     libxrender1 \
#     libxss1 \
#     libxtst6 \
#     lsb-release \
#     wget \
#     xdg-utils \
#     # 中文字体
#     fonts-wqy-microhei \
#     fonts-wqy-zenhei \
#     python3-setuptools \
#     && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    # 中文字体 (必带，否则网页中文乱码)
    fonts-wqy-microhei \
    # Python 编译依赖 (解决你之前的 sqlite3 报错)
    python3-setuptools \
    # Chromium 运行的核心依赖 (剔除了 libc6, libgcc1 等基础系统已有的库)
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
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
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 重新生成字体缓存，确保中文字体可用
RUN dpkg-reconfigure fontconfig

# 设置环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# 设置工作目录
WORKDIR /app

# 先复制依赖清单，最大化利用 Docker 层缓存
COPY package.json bun.lock ./

# 使用 bun 用户安装依赖，减少权限问题
RUN chown -R bun:bun /app

# 安装 bun 依赖
USER bun
RUN bun install --frozen-lockfile

USER root
RUN apt remove -y --no-install-recommends python3-setuptools && apt autoremove -y && apt clean

# 再复制业务代码，避免每次代码变动都失去依赖缓存
COPY --chown=bun:bun . .

USER bun

# 预创建持久化目录
RUN mkdir -p /app/src/data /app/src/config /app/src/logs

# 定义卷挂载点（建议运行时使用具名卷或宿主机目录挂载）
VOLUME ["/app/src/data", "/app/src/config", "/app/src/logs"]

# 启动应用
CMD ["bun", "start"]
