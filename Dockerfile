# 使用官方 bun 镜像作为基础镜像
FROM oven/bun:latest

# 安装 git
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 将本地代码复制到容器中
COPY . .

# 克隆官方插件库
RUN git clone https://github.com/HkTeamX/Minato-Official-Plugins.git ./Minato-Official-Plugins

# 执行 bun install 安装依赖
RUN bun install --frozen-lockfile

# 删除 git（已不再需要）
RUN apt-get remove -y git && apt-get autoremove -y

# 创建数据和配置目录
RUN mkdir -p /app/data /app/config

# 定义卷挂载点
VOLUME ["/app/src/data", "/app/src/config"]

# 启动应用
CMD ["bun", "./src/index.ts"]
