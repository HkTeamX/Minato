import { ATRI, CommanderUtils, performanceCounter, type BotConfig } from '@atri-bot/core'
import { Logger, LogLevel } from '@huan_kong/logger'
import { Command } from 'commander'
import { config } from 'dotenv'
import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import path from 'node:path'
import process from 'node:process'

const getElapsedTime = performanceCounter()

config({
  path: path.join(import.meta.dirname, '../.env'),
  quiet: true,
})

const opts = new Command()
  .option('-d, --debug', '启用调试模式')
  .option(
    '-l, --logLevel <level>',
    '设置日志级别',
    CommanderUtils.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
    undefined,
  )
  .parse(process.argv)

const debug = opts.getOptionValue('debug') as boolean
const logLevel = LogLevel[opts.getOptionValue('logLevel')] as unknown as LogLevel | undefined

const logger = new Logger({
  title: 'Minato',
  level: logLevel ?? (debug ? LogLevel.DEBUG : undefined),
})

logger.INFO('开始加载 Minato')

const botConfig: BotConfig = {
  prefix: JSON.parse(process.env.PREFIX ?? '["/"]'),
  adminId: JSON.parse(process.env.ADMIN_ID ?? '[10001]'),
  connection: {
    protocol: (process.env.NC_PROTOCOL ?? 'ws') as NCWebsocketOptionsHost['protocol'],
    host: process.env.NC_HOST ?? '127.0.0.1',
    port: parseInt(process.env.NC_PORT ?? '3001'),
    accessToken: process.env.NC_ACCESS_TOKEN,
  },
  reconnection: {
    enable: process.env.NC_RECONNECTION_ENABLE === 'true',
    attempts: parseInt(process.env.NC_RECONNECTION_ATTEMPTS ?? '10'),
    delay: parseInt(process.env.NC_RECONNECTION_DELAY ?? '5000'),
  },
}

await ATRI.init({
  debug,
  bot: botConfig,
  baseDir: import.meta.dirname,
  plugins: ['@atri-bot/plugin-plugin-store'],
  logLevel: logLevel,
})

logger.INFO(`Minato 加载完成! 总耗时: ${getElapsedTime()}ms`)
