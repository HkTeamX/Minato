import { ATRI, performanceCounter, type BotConfig } from '@atri-bot/core'
import { Logger, LogLevel } from '@huan_kong/logger'
import { config } from 'dotenv'
import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import path from 'node:path'
import process from 'node:process'

const getElapsedTime = performanceCounter()

config({
  path: path.join(import.meta.dirname, '../.env'),
  quiet: true,
})

const debug = process.argv.includes('--debug')

const logger = new Logger({
  title: 'Minato',
  level: debug ? LogLevel.DEBUG : undefined,
})

logger.INFO('开始加载 Minato')

const bot: BotConfig = {
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
  bot,
  debug,
  baseDir: import.meta.dirname,
  plugins: ['@atri-bot/plugin-plugin-store'],
})

logger.INFO(`Minato 加载完成! 总耗时: ${getElapsedTime()}ms`)
