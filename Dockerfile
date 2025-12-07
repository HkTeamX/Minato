# 使用官方 bun 镜像作为基础镜像
FROM oven/bun:latest

# 设置工作目录
WORKDIR /app

# 将本地代码复制到容器中
COPY . .

# 执行 bun install 安装依赖
RUN bun install

# 创建数据和配置目录
RUN mkdir -p /app/data /app/config

# 定义卷挂载点
VOLUME ["/app/data", "/app/config"]

# 启动应用
CMD ["bun", "start"]
