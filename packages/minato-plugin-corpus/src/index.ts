import {
  type CommandCallback,
  type MessageCallback,
  BasePlugin,
  CommanderUtils,
} from '@atri-bot/core'
import { Db } from '@atri-bot/lib-db'
import { Command } from 'commander'
import { Corpus, initDb } from './db.js'
import { type AllHandlers, type Receive, type SendMessageSegment, Structs } from 'node-napcat-ts'
import {
  type ForgetState,
  type LearnCorpusCommandContext,
  type Rule,
  CorpusPluginConfig,
  LearnState,
} from './types.js'
import path from 'node:path'
import { Axios } from '@atri-bot/lib-request'
import fs from 'node:fs'
import { Plugin as GuGuPlugin } from '@minato-bot/atri-bot-plugin-gugu'

export class Plugin extends BasePlugin<CorpusPluginConfig> {
  defaultConfig: CorpusPluginConfig = {
    learnCost: 50,
    forgetCost: 20,
    timeout: 5 * 60 * 1000,
  }
  db = new Db(this.atri.config)
  axios = new Axios(this.atri.config)

  // 图片存储路径
  imagePath = path.join(this.atri.config.baseDir, '/data/images')

  // 加载的规则
  rules: Rule[] = []
  // 用户学习状态
  learners: Map<number, LearnState> = new Map()
  // 用户忘记状态
  forgeters: Map<number, ForgetState> = new Map()

  // 加载
  guguPlugin!: GuGuPlugin

  async load() {
    await initDb(this.db.sequelize)

    const plugin = await this.atri.loadPlugin<GuGuPlugin>('@minato-bot/atri-bot-plugin-gugu')
    if (plugin[0] !== 0) {
      throw new Error('Corpus插件加载失败, 加载 @minato-bot/atri-bot-plugin-gugu 插件失败')
    }

    this.guguPlugin = plugin[1]

    await this.loadRules()
    if (!fs.existsSync(this.imagePath)) fs.mkdirSync(this.imagePath, { recursive: true })

    this.regMessageEvent({
      priority: 999,
      callback: this.interceptMessage.bind(this),
    })

    this.regMessageEvent({
      priority: 1,
      callback: this.matchMessages.bind(this),
    })

    this.regCommandEvent({
      commandName: '空空学习',
      commander: new Command()
        .description('学习关键词回复')
        .option(
          '-m, --mode <mode>',
          '匹配模式: 模糊 或 精准',
          CommanderUtils.enum(['模糊', '精准']),
          '精准',
        )
        .option(
          '-s, --scene <scene>',
          '生效范围: 全部 私聊 群聊',
          CommanderUtils.enum(['全部', '私聊', '群聊']),
          '全部',
        ),
      callback: this.learn.bind(this),
    })

    this.regCommandEvent({
      commandName: '空空忘记',
      commander: new Command().description('忘记关键词回复'),
      callback: this.forget.bind(this),
    })
  }

  unload() {}

  // 加载规则
  async loadRules() {
    const rules = await Corpus.findAll({
      where: {
        deleted_at: null,
      },
    })

    this.rules = rules.map(
      (rule) =>
        ({
          ...rule.get(),
          keyword: JSON.parse(rule.keyword) as Receive[keyof Receive][],
          reply: JSON.parse(rule.reply) as SendMessageSegment[keyof SendMessageSegment][],
        }) as Rule,
    )
  }

  /**
   * 匹配消息
   */
  matchMessages({ context }: MessageCallback) {
    for (const rule of this.rules) {
      if (this.matchMessage(rule, context)) {
        const reply = rule.reply.map((segment) => {
          if (segment.type !== 'image') return segment

          if (!fs.existsSync(segment.data.file)) {
            return segment
          }

          const fileData = fs.readFileSync(segment.data.file)
          const base64Data = fileData.toString('base64')
          return Structs.image(`base64://${base64Data}`)
        })
        this.bot.sendMsg(context, reply, { reply: false, at: false })
      }
    }
  }

  matchMessage(rule: Rule, context: AllHandlers['message']): boolean {
    if (
      (rule.scene === '私聊' && context.message_type !== 'private') ||
      (rule.scene === '群聊' && context.message_type !== 'group') ||
      rule.keyword.length !== context.message.length
    ) {
      return false
    }

    for (const [index, message] of context.message.entries()) {
      const keyword = rule.keyword[index] as Receive[keyof Receive]
      if (keyword.type !== message.type) return false

      if (
        keyword.type === 'text' &&
        message.type === 'text' &&
        keyword.data.text !== message.data.text
      ) {
        return false
      }

      if (
        keyword.type === 'face' &&
        message.type === 'face' &&
        keyword.data.id !== message.data.id
      ) {
        return false
      }
    }

    return true
  }

  // 学习命令
  async learn({ context, params }: CommandCallback<LearnCorpusCommandContext>) {
    const info = await this.guguPlugin.getUserPigeonInfo(context.user_id)
    if (info.pigeon_num < this.config.learnCost) {
      await this.bot.sendMsg(context, [
        Structs.text(
          `学习需要消耗 ${this.config.learnCost} 只鸽子，你当前只有 ${info.pigeon_num} 只鸽子，无法学习~`,
        ),
      ])
      return
    }

    this.learners.set(context.user_id, {
      step: 1,
      mode: params.mode,
      scene: params.scene,
      context,
      timer: setTimeout(() => {
        this.learners.delete(context.user_id)
        this.bot.sendMsg(context, [Structs.text('学习已超时，已自动退出~')])
      }, this.config.timeout),
    })

    await this.bot.sendMsg(context, [Structs.text('请输入关键词\n回复 退出 来退出学习')])
  }

  // 忘记命令
  async forget({ context }: CommandCallback) {
    const info = await this.guguPlugin.getUserPigeonInfo(context.user_id)
    if (info.pigeon_num < this.config.forgetCost) {
      await this.bot.sendMsg(context, [
        Structs.text(
          `忘记需要消耗 ${this.config.forgetCost} 只鸽子，你当前只有 ${info.pigeon_num} 只鸽子，无法忘记~`,
        ),
      ])
      return
    }

    this.forgeters.set(context.user_id, {
      step: 1,
      timer: setTimeout(() => {
        this.forgeters.delete(context.user_id)
        this.bot.sendMsg(context, [Structs.text('忘记已超时，已自动退出~')])
      }, this.config.timeout),
    })

    await this.bot.sendMsg(context, [Structs.text('请输入要忘记的关键词\n回复 退出 来退出忘记')])
  }

  // 监听消息，处理学习和忘记状态机
  async interceptMessage({ context }: MessageCallback) {
    const learnState = this.learners.get(context.user_id)
    if (learnState) {
      return await this.handleLearnState(context, learnState)
    }

    const forgetState = this.forgeters.get(context.user_id)
    if (forgetState) {
      return await this.handleForgetState(context, forgetState)
    }
  }

  /**
   * 处理学习状态机
   */
  async handleLearnState(context: AllHandlers['message'], state: LearnState) {
    const firstMessage = context.message[0]
    const isQuit = firstMessage?.type === 'text' && firstMessage.data.text === '退出'

    if (isQuit) {
      clearTimeout(state.timer)
      this.learners.delete(context.user_id)
      await this.bot.sendMsg(context, [Structs.text('学习已退出~')])
      return 'quit'
    }

    state.timer.refresh()

    if (state.step === 1) {
      // 第一步：获取关键词
      const valid = await this.validateKeyword(context)
      if (!valid) return 'quit'

      // 检查关键词是否已存在
      const exists = await Corpus.findOne({
        where: {
          keyword: JSON.stringify(context.message),
          deleted_at: null,
        },
      })

      if (exists) {
        await this.bot.sendMsg(context, [Structs.text('关键词已存在，请重新输入')])
        return 'quit'
      }

      state.keyword = context
      state.step = 2
      await this.bot.sendMsg(context, [Structs.text('请输入回复内容\n回复 退出 来退出学习')])
      return 'quit'
    }

    if (state.step === 2) {
      state.reply = context
      state.step = 3
      await this.bot.sendMsg(context, [Structs.text('确认保存吗? [Y/N]\n回复 退出 来退出学习')])
      return 'quit'
    }

    if (state.step === 3) {
      // 第三步：确认
      const confirm = firstMessage?.type === 'text' && firstMessage.data.text.toUpperCase() === 'Y'

      if (confirm) {
        const result = await this.guguPlugin.reduceUserPigeonNum(
          state.context.user_id,
          this.config.forgetCost,
          '学习关键词',
        )

        if (!result) {
          clearTimeout(state.timer)
          this.learners.delete(context.user_id)
          await this.bot.sendMsg(context, [Structs.text('扣除鸽子失败，学习已取消~')])
          return 'quit'
        }

        // 检查reply中是否存在图片, 如果有图片则下载图片然后保存
        for (let index = 0; index < state.reply!.message.length; index++) {
          const element = state.reply!.message[index]
          if (element.type === 'image') {
            try {
              const res = await this.axios.downloadFile(
                { url: element.data.url },
                this.imagePath,
                element.data.file,
              )
              state.reply!.message[index] = Structs.image(res) as Receive['image']
            } catch {
              // 下载失败则使用原始链接
            }
          }
        }

        await Corpus.create({
          user_id: state.context.user_id,
          keyword: JSON.stringify(state.keyword!.message),
          reply: JSON.stringify(state.reply!.message),
          mode: state.mode,
          scene: state.scene,
        })

        clearTimeout(state.timer)
        this.learners.delete(context.user_id)
        await this.bot.sendMsg(context, [Structs.text('学习成功~')])
        await this.loadRules()
      } else {
        clearTimeout(state.timer)
        this.learners.delete(context.user_id)
        await this.bot.sendMsg(context, [Structs.text('已取消学习')])
      }
      return 'quit'
    }
  }

  /**
   * 处理忘记状态机
   */
  async handleForgetState(context: AllHandlers['message'], state: ForgetState) {
    const firstMessage = context.message[0]
    const isQuit = firstMessage?.type === 'text' && firstMessage.data.text === '退出'

    if (isQuit) {
      this.forgeters.delete(context.user_id)
      await this.bot.sendMsg(context, [Structs.text('忘记已退出~')])
      return 'quit'
    }

    state.timer.refresh()

    if (state.step === 1) {
      // 第一步：获取要删除的关键词
      const valid = await this.validateKeyword(context)
      if (!valid) return 'quit'

      const corpus = await Corpus.findOne({
        where: {
          keyword: JSON.stringify(context.message),
          deleted_at: null,
        },
      })

      if (!corpus) {
        await this.bot.sendMsg(context, [Structs.text('关键词不存在，请重新输入')])
        return 'quit'
      }

      // 检查权限
      if (
        corpus.user_id !== context.user_id &&
        !this.bot.config.adminId.includes(context.user_id)
      ) {
        await this.bot.sendMsg(context, [Structs.text('无权删除他人的关键词')])
        return 'quit'
      }

      state.context = context
      state.step = 2
      await this.bot.sendMsg(context, [Structs.text('确认忘记吗? [Y/N]\n回复 退出 来退出忘记')])
      return 'quit'
    }

    if (state.step === 2) {
      // 第二步：确认删除
      const confirm = firstMessage?.type === 'text' && firstMessage.data.text.toUpperCase() === 'Y'

      if (confirm && state.context) {
        const result = await this.guguPlugin.reduceUserPigeonNum(
          state.context.user_id,
          this.config.forgetCost,
          '忘记关键词',
        )

        if (!result) {
          clearTimeout(state.timer)
          this.learners.delete(context.user_id)
          await this.bot.sendMsg(context, [Structs.text('扣除鸽子失败，忘记已取消~')])
          return 'quit'
        }

        const corpus = await Corpus.findOne({
          where: {
            keyword: JSON.stringify(context.message),
            deleted_at: null,
          },
        })

        if (corpus) {
          await corpus.update({ deleted_at: new Date() })
        }

        this.forgeters.delete(context.user_id)
        await this.bot.sendMsg(context, [Structs.text('忘记成功~')])
        await this.loadRules()
      } else {
        this.forgeters.delete(context.user_id)
        await this.bot.sendMsg(context, [Structs.text('已取消忘记')])
      }
      return 'quit'
    }
  }

  /**
   * 验证关键词的合法性
   */
  async validateKeyword(context: AllHandlers['message']): Promise<boolean> {
    const validTypes = ['text', 'face']

    if (!context.message.every((m) => validTypes.includes(m.type))) {
      await this.bot.sendMsg(context, [Structs.text('关键词只支持文本和表情，请重新输入')])
      return false
    }

    return true
  }
}
