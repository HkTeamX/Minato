import type { ImageSearcherConfig } from './config.js'
import { Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }
import { buildRequestParams } from './utils.js'

export const plugin = new Plugin<ImageSearcherConfig>(PackageJson.name)
  .setDefaultConfig([
    {
      key: 'engines',
      val: {
        Ascii2d: { reduce: 5, limit: 3, flareSolverr: '' },
        SauceNAO: { reduce: 5, limit: 3 },
        Iqdb: { reduce: 5, limit: 3 },
        TinEye: { reduce: 5, limit: 3 },
        AnimeTrace: { reduce: 5, limit: 3 },
        TraceMoe: { reduce: 5, limit: 3 },
      },
      comment: '各个搜图引擎的配置项',
    },
    {
      key: 'timeout',
      val: 10,
      comment: '搜图模式自动退出秒数',
    },
    {
      key: 'in_reply',
      val: '已开启搜图模式~\n可以说 "退出" 来退出搜图模式哦~',
      comment: '开启搜图模式后的回复',
    },
    {
      key: 'out_reply',
      val: '已退出搜图模式~',
      comment: '退出搜图模式后的回复',
    },
    {
      key: 'timeout_reply',
      val: '已自动退出搜图模式~',
      comment: '搜图模式超时后的回复',
    },
  ])

export const startSearchImageCommand = plugin
  .command('空空搜图')
  .callback(async ({ context, config, bot }) => {
    await bot.sendMsg(context, [Structs.text(config.in_reply)])

    const message = await bot.useMessage(context, {
      timeout: config.timeout * 1000,
      replyMsg: config.timeout_reply,
    })

    if (!message) {
      return
    }

    const firstMessage = message.message[0]
    if (firstMessage.type === 'text' && firstMessage.data.text.trim() === '退出') {
      await bot.sendMsg(context, [Structs.text(config.out_reply)])
      return
    }

    const images = message.message.filter(item => item.type === 'image')
    if (images.length === 0) {
      await bot.sendMsg(context, [Structs.text('请发送至少一张图片哦~')])
      return
    }

    for (const image of images) {
      const imageUrl = image.data.url
      if (!imageUrl) {
        continue
      }

      const engines = buildRequestParams(context.user_id, imageUrl, config)
      const messages = await Promise.all(engines)
      await bot.sendForwardMsg(context, messages)
    }
  })
