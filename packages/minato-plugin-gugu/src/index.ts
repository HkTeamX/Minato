import { BasePlugin, type CommandCallback, CommanderUtils } from '@atri-bot/core'
import { Db } from '@atri-bot/lib-db'
import { Command } from 'commander'
import dayjs from 'dayjs'
import { Structs } from 'node-napcat-ts'
import { Op } from 'sequelize'
import { initDb, PigeonHistories, Pigeons } from './db.js'

export interface GuGuPluginConfig {
  addRange: [number, number]
}

export interface QueryPigeonCommandContext {
  args: [number?]
}

export interface RankPigeonCommandContext {
  params: {
    page: number
    size: number
  }
}

export class Plugin extends BasePlugin<GuGuPluginConfig> {
  defaultConfig: GuGuPluginConfig = {
    addRange: [0, 100],
  }
  db = new Db(this.atri.config)

  async load() {
    await initDb(this.db.sequelize)

    this.regCommandEvent({
      commandName: /咕咕/,
      commander: new Command().description('咕咕签到'),
      callback: this.gugu.bind(this),
    })

    this.regCommandEvent({
      commandName: /我的鸽子|查鸽子/,
      commander: new Command().description('查询鸽子数').argument('[user_id]'),
      callback: this.query.bind(this),
    })

    this.regCommandEvent({
      commandName: '鸽子排行',
      commander: new Command()
        .description('查询鸽子排行')
        .option('-p, --page <page>', '页数', CommanderUtils.float({ min: 1 }), 1)
        .option('-s, --size <size>', '每页数量', CommanderUtils.float({ max: 20 }), 10),
      callback: this.rank.bind(this),
    })
  }

  unload() {}

  async gugu({ context }: CommandCallback) {
    const today = dayjs()
    const isGuguToday = await PigeonHistories.findOne({
      where: {
        user_id: context.user_id,
        reason: '每日咕咕',
        created_at: {
          [Op.between]: [today.startOf('day').toDate(), today.endOf('day').toDate()],
        },
      },
    })
    if (isGuguToday) {
      await this.bot.sendMsg(context, [Structs.text(`今天已经咕咕过了! 明天再来吧!`)])
      return
    }

    const addNum = this.randomInt(this.config.addRange[0], this.config.addRange[1])
    const result = await this.addUserPigeonNum(context.user_id, addNum, '每日咕咕')
    if (!result) {
      await this.bot.sendMsg(context, [Structs.text(`修改鸽子数失败!`)])
      return
    }

    await this.bot.sendMsg(context, [Structs.text(`咕咕成功! 获得 ${addNum} 只鸽子!`)])
  }

  async rank({ context, params }: CommandCallback<RankPigeonCommandContext>) {
    const page = params.page
    const pageSize = params.size
    const offset = (page - 1) * pageSize

    const { rows, count } = await Pigeons.findAndCountAll({
      order: [['pigeon_num', 'DESC']],
      limit: pageSize,
      offset,
    })

    if (rows.length === 0) {
      await this.bot.sendMsg(context, [Structs.text(`暂无鸽子数据!`)])
      return
    }

    const rankList = await Promise.all(
      rows.map(async (item, index) => {
        const username = await this.bot.getUsername({ user_id: item.user_id })
        return `${offset + index + 1}. 用户: ${username} 共有 ${item.pigeon_num} 只鸽子`
      }),
    )

    await this.bot.sendMsg(context, [
      Structs.text(
        `鸽子排行 (第 ${page} 页 / 共 ${Math.ceil(count / pageSize)} 页):\n` + rankList.join('\n'),
      ),
    ])
  }

  async query({ context, args }: CommandCallback<QueryPigeonCommandContext>) {
    const user_id = args[0] ?? context.user_id
    const result = await this.getUserPigeonInfo(user_id)
    await this.bot.sendMsg(context, [
      Structs.text(
        `用户 ${await this.bot.getUsername({ ...context, user_id })} 共有 ${result.pigeon_num} 只鸽子!`,
      ),
    ])
  }

  randomInt(min = 0, max = 1) {
    // 确保min和max都是整数
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  async getUserPigeonInfo(user_id: number): Promise<Pigeons> {
    const pigeonInfo = await Pigeons.findOne({ where: { user_id } })
    if (pigeonInfo) return pigeonInfo
    await Pigeons.create({ user_id, pigeon_num: 0 })
    return await this.getUserPigeonInfo(user_id)
  }

  async addUserPigeonNum(user_id: number, addNum: number, reason: string) {
    const pigeonInfo = await this.getUserPigeonInfo(user_id)
    if (addNum < 0) return false
    pigeonInfo.pigeon_num += addNum
    await pigeonInfo.save()

    await PigeonHistories.create({
      user_id,
      operation: addNum,
      prev_num: pigeonInfo.pigeon_num - addNum,
      current_num: pigeonInfo.pigeon_num,
      reason,
    })

    return true
  }

  async reduceUserPigeonNum(user_id: number, reduceNum: number, reason: string) {
    const pigeonInfo = await this.getUserPigeonInfo(user_id)
    if (reduceNum <= 0 || pigeonInfo.pigeon_num - reduceNum < 0) return false
    pigeonInfo.pigeon_num -= reduceNum
    await pigeonInfo.save()

    await PigeonHistories.create({
      user_id,
      operation: reduceNum,
      prev_num: pigeonInfo.pigeon_num + reduceNum,
      current_num: pigeonInfo.pigeon_num,
      reason,
    })

    return true
  }
}
