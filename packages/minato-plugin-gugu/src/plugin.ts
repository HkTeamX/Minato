import { randomInt } from 'node:crypto'
import { Plugin } from '@atri-bot/core'
import dayjs from 'dayjs'
import { and, between, desc, eq } from 'drizzle-orm'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import PackageJson from '../package.json' with { type: 'json' }
import { Schema } from './db.js'
import { addUserPigeonNum, getDrizzle, getUserPigeonInfo } from './dbUtils.js'

export const guguPluginGuguRegexp = /咕咕/
export async function handleGuguCommand(user_id: number, addRange: [number, number]) {
  const today = dayjs()
  const Drizzle = await getDrizzle()

  const isGuguToday = await Drizzle.select()
    .from(Schema.PigeonHistories)
    .where(
      and(
        eq(Schema.PigeonHistories.user_id, user_id),
        eq(Schema.PigeonHistories.reason, '每日咕咕'),
        between(
          Schema.PigeonHistories.created_at,
          today.startOf('day').toDate(),
          today.endOf('day').toDate(),
        ),
      ),
    )
    .then(res => res.length > 0)

  if (isGuguToday) {
    return [Structs.text(`今天已经咕咕过了! 明天再来吧!`)]
  }

  const addNum = randomInt(addRange[0], addRange[1])
  const result = await addUserPigeonNum(user_id, addNum, '每日咕咕')
  if (!result) {
    return [Structs.text(`修改鸽子数失败!`)]
  }

  return [Structs.text(`咕咕成功! 获得 ${addNum} 只鸽子!`)]
}

export const queryPigeonRegexp = /我的鸽子|查鸽子/
export const queryPigeonCommander = yargs().option('user_id', {
  type: 'number',
  description: '要查询的用户ID，默认为自己',
})

export const pigeonRankRegexp = /鸽子排行/
export const pigeonRankCommander = yargs().option('page', {
  alias: 'p',
  type: 'number',
  description: '页码，默认为1',
  default: 1,
}).option('size', {
  alias: 's',
  type: 'number',
  description: '每页数量，默认为10，最大20',
  default: 10,
})

export const plugin = new Plugin(PackageJson.name)
  .setDefaultConfig<{
  addRange: [number, number]
  firstAdd: number
}>({
    addRange: [1, 100],
    firstAdd: 300,
  })
  .onInstall(
    async ({ event, config, bot }) => {
      const Drizzle = await getDrizzle()

      event.regCommandEvent({
        trigger: guguPluginGuguRegexp,
        callback: async ({ context }) => {
          const user_id = context.user_id
          const pigronInfo = await Drizzle.query.Pigeons.findFirst({ where: { user_id } })
          if (!pigronInfo || !pigronInfo.gugued) {
            await addUserPigeonNum(user_id, config.firstAdd, '初始赠送')
            await bot.sendMsg(context, [Structs.text(`欢迎第一次咕咕! 作为初始奖励, 你获得了 ${config.firstAdd} 只鸽子!`)])
          }

          const result = await handleGuguCommand(user_id, config.addRange)
          await bot.sendMsg(context, result)
        },
      })

      event.regCommandEvent({
        trigger: queryPigeonRegexp,
        commander: queryPigeonCommander,
        callback: async ({ context, options }) => {
          const result = await getUserPigeonInfo(options.user_id ?? context.user_id)
          const username = await bot.getUsername({ user_id: result.user_id })
          await bot.sendMsg(context, [Structs.text(`用户 ${username} 共有 ${result.pigeon_num} 只鸽子!`)])
        },
      })

      event.regCommandEvent({
        trigger: pigeonRankRegexp,
        commander: pigeonRankCommander,
        callback: async ({ context, options }) => {
          const page = Math.max(1, options.page)
          const size = Math.max(1, Math.min(20, options.size))
          const offset = (page - 1) * size
          const rows = await Drizzle.select()
            .from(Schema.Pigeons)
            .orderBy(desc(Schema.Pigeons.pigeon_num))
            .limit(size)
            .offset(offset)

          if (rows.length === 0) {
            await bot.sendMsg(context, [Structs.text(`暂无鸽子数据！`)])
            return
          }

          const total = await Drizzle.select().from(Schema.Pigeons)
          const totalPages = Math.ceil(total.length / size)
          const rankList = await Promise.all(
            rows.map(async (item, index) => {
              const username = await bot.getUsername({ user_id: item.user_id })
              return `${offset + index + 1}. 用户: ${username} 共有 ${item.pigeon_num} 只鸽子`
            }),
          )

          await bot.sendMsg(context, [
            Structs.text(
              `鸽子排行 (第 ${page} 页 / 共 ${totalPages} 页):\n${rankList.join('\n')}`,
            ),
          ])
        },
      })
    },
  )
