FROM oven/bun:alpine

# 设置工作目录
WORKDIR /app

# 从构建阶段复制必要的文件
COPY . .

# 执行 bun install 安装依赖（跳过 devDependencies）
RUN bun install --frozen-lockfile --production

# 创建数据和配置目录
RUN mkdir -p /app/src/data /app/src/config

# 定义卷挂载点
VOLUME ["/app/src/data", "/app/src/config"]

# 启动应用
CMD ["bun", "start"]
