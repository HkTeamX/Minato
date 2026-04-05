// eslint-disable-next-line unused-imports/no-unused-imports
import type { Argv, Bot } from '@atri-bot/core'
import type { TextSegment } from 'node-napcat-ts'
import { randomInt } from 'node:crypto'
import { Plugin } from '@atri-bot/core'
import dayjs from 'dayjs'
import { and, between, desc, eq } from 'drizzle-orm'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }
import { Schema } from './db.js'
import { addUserPigeonNum, getDrizzle, getUserPigeonInfo } from './dbUtils.js'

export interface GuguPluginConfig {
  addRange: [number, number]
  firstAdd: number
}

export const plugin = new Plugin<GuguPluginConfig>(PackageJson.name)
  .setDefaultConfig([
    {
      key: 'addRange',
      val: [1, 100],
      comment: '每次咕咕获得的鸽子数量范围: [最小值, 最大值]',
    },
    {
      key: 'firstAdd',
      val: 300,
      comment: '首次咕咕获得的鸽子数量',
    },
  ])
  .onInstall(async () => {
    // 预热数据库连接，避免首次使用时的延迟
    await getDrizzle()
  })

export async function handleGuguCommand(user_id: number, config: GuguPluginConfig): Promise<[TextSegment[], TextSegment[]]> {
  const returnMsg: [TextSegment[], TextSegment[]] = [[], []]
  const Drizzle = await getDrizzle()

  const pigronInfo = await Drizzle.query.Pigeons.findFirst({ where: { user_id } })
  if (!pigronInfo || !pigronInfo.gugued) {
    await addUserPigeonNum(user_id, config.firstAdd, '初始赠送')
    returnMsg[0].push(Structs.text(`欢迎第一次咕咕! 作为初始奖励, 你获得了 ${config.firstAdd} 只鸽子!`))
  }

  const today = dayjs()

  const isGugued = await Drizzle.select()
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

  if (isGugued) {
    returnMsg[1].push(Structs.text(`今天已经咕咕过了! 明天再来吧!`))
    return returnMsg
  }

  const addNum = randomInt(config.addRange[0], config.addRange[1])
  const result = await addUserPigeonNum(user_id, addNum, '每日咕咕')
  if (!result) {
    returnMsg[1].push(Structs.text(`修改鸽子数失败!`))
    return returnMsg
  }

  returnMsg[1].push(Structs.text(`咕咕成功! 获得 ${addNum} 只鸽子!`))
  return returnMsg
}

export const guguCommand = plugin
  .command(/咕咕/)
  .callback(async ({ context, config, bot }, next) => {
    next()

    const msg = await handleGuguCommand(context.user_id, config)
    msg.forEach(async (segments) => {
      if (segments.length <= 0) {
        return
      }

      await bot.sendMsg(context, segments)
    })
  })

export const queryPigeonCommand = plugin
  .command(/我的鸽子|查鸽子/)
  .commander(yargs =>
    yargs()
      .option('user_id', {
        type: 'number',
        description: '要查询的用户ID，默认为自己',
      }),
  )
  .callback(async ({ context, options, bot }) => {
    const result = await getUserPigeonInfo(options.user_id ?? context.user_id)
    const username = await bot.getUsername({ user_id: result.user_id })
    await bot.sendMsg(context, [Structs.text(`用户 ${username} 共有 ${result.pigeon_num} 只鸽子!`)])
  })

export async function handlePigeonRankCommand(bot: Bot, options: { page: number, size: number }): Promise<TextSegment[]> {
  const page = Math.max(1, options.page)
  const size = Math.max(1, Math.min(20, options.size))
  const offset = (page - 1) * size
  const Drizzle = await getDrizzle()

  const rows = await Drizzle.select()
    .from(Schema.Pigeons)
    .orderBy(desc(Schema.Pigeons.pigeon_num))
    .limit(size)
    .offset(offset)

  if (rows.length === 0) {
    return [Structs.text('暂无鸽子数据！')]
  }

  const total = await Drizzle.select().from(Schema.Pigeons)
  const totalPages = Math.ceil(total.length / size)
  const rankList = await Promise.all(
    rows.map(async (item, index) => {
      const username = await bot.getUsername({ user_id: item.user_id })
      return `${offset + index + 1}. 用户: ${username} 共有 ${item.pigeon_num} 只鸽子`
    }),
  )

  return [
    Structs.text(`鸽子排行 (第 ${page} 页 / 共 ${totalPages} 页):\n`),
    Structs.text(`使用命令 -p <页码> -s <每页数量> 可指定过滤条件\n`),
    Structs.text(rankList.join('\n')),
  ]
}

export const pigeonRankCommand = plugin
  .command('鸽子排行')
  .commander(yargs =>
    yargs()
      .option('page', {
        alias: 'p',
        type: 'number',
        description: '页码，默认为1',
        default: 1,
      })
      .option('size', {
        alias: 's',
        type: 'number',
        description: '每页数量，默认为10，最大20',
        default: 10,
      }),
  )
  .callback(async ({ context, options, bot }) => {
    const msg = await handlePigeonRankCommand(bot, options)
    await bot.sendMsg(context, msg)
  })
