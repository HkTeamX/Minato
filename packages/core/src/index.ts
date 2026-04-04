import process from 'node:process'
import { ATRI } from '@atri-bot/core'
import { initDb } from '@atri-bot/lib-db'
import { Logger, LogLevel } from '@huan_kong/logger'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }
import { config } from './config.js'

const startTime = process.hrtime.bigint()

process.env.TZ = config.TIMEZONE

const level = LogLevel[config.LOG_LEVEL as keyof typeof LogLevel]

const logger = new Logger({
  title: 'Minato',
  level,
})

logger.INFO('开始加载 Minato')

const atri = new ATRI({
  name: 'Minato',
  version: PackageJson.version,
  logLevel: level,
  configDir: config.CONFIG_DIR,
  logDir: config.LOG_DIR,
  dataDir: config.DATA_DIR,
  saveLogs: config.SAVE_LOGS ?? level > LogLevel.DEBUG,
  modulesDir: config.MODULES_DIR,
  botConfig: {
    prefix: config.PREFIX,
    adminId: config.ADMIN_ID,
    protocol: config.NC_PROTOCOL,
    host: config.NC_HOST,
    port: Number.parseInt(process.env.NC_PORT ?? '3001'),
    accessToken: process.env.NC_ACCESS_TOKEN,
    reconnection: {
      enable: process.env.NC_RECONNECTION_ENABLE === 'true',
      attempts: Number.parseInt(process.env.NC_RECONNECTION_ATTEMPTS ?? '10'),
      delay: Number.parseInt(process.env.NC_RECONNECTION_DELAY ?? '5000'),
    },
  },
})

;(async () => {
  await atri.init()

  await initDb({
    connectString: config.DATABASE_URL,
  })

  await atri.installPlugin('@atri-bot/plugin-help')
  await atri.installPlugin('@atri-bot/plugin-proxy')
  await atri.installPlugin('@minato-bot/plugin-gugu')
  await atri.installPlugin('@minato-bot/plugin-wxjsxy')

  const totalTime = (process.hrtime.bigint() - startTime) / BigInt(1e6)

  logger.INFO(`Minato 加载完成! 总耗时: ${totalTime}ms`)

  if (level >= LogLevel.INFO) {
    atri.bot.config.adminId.forEach(adminId =>
      atri.bot.sendMsg(
        { message_type: 'private', user_id: adminId },
        [Structs.text(`Minato 启动完成! 总耗时: ${totalTime}ms`)],
      ),
    )
  }
})()
