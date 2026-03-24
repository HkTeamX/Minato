import type { NonEmptyArray } from '@atri-bot/core'
import env from 'env-var'

export const config = {
  NODE_ENV: env.get('NODE_ENV').default('production').asEnum(['production', 'development']),

  LOG_LEVEL: env.get('LOG_LEVEL').default('INFO').asEnum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
  TIMEZONE: env.get('TIMEZONE').default('Asia/Shanghai').asString(),
  CONFIG_DIR: env.get('CONFIG_DIR').default('./config').asString(),
  LOG_DIR: env.get('LOG_DIR').default('./logs').asString(),
  SAVE_LOGS: env.get('SAVE_LOGS').asBool(),

  PREFIX: env.get('PREFIX').required().asJson() as NonEmptyArray<string>,
  ADMIN_ID: env.get('ADMIN_ID').required().asJson() as NonEmptyArray<number>,
  NC_PROTOCOL: env.get('NC_PROTOCOL').required().asEnum(['ws', 'wss']),
  NC_PORT: env.get('NC_PORT').required().asPortNumber(),
  NC_HOST: env.get('NC_HOST').required().asString(),
  NC_ACCESS_TOKEN: env.get('NC_ACCESS_TOKEN').required().asString(),

  NC_RECONNECTION_ENABLE: env.get('NC_RECONNECTION_ENABLE').default('true').asBool(),
  NC_RECONNECTION_ATTEMPTS: env.get('NC_RECONNECTION_ATTEMPTS').default('10').asInt(),
  NC_RECONNECTION_DELAY: env.get('NC_RECONNECTION_DELAY').default('5000').asInt(),
}
