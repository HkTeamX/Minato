// eslint-disable-next-line unused-imports/no-unused-imports
import type { Argv } from '@atri-bot/core'
import type { getDyProcessReq, LoginToCasReq } from './api.js'
import { Plugin } from '@atri-bot/core'
import { removeCronJob } from '@atri-bot/lib-cron'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }
import { getDyProcessDetail, getDyProcessList, loginToCas } from './api.js'
import { checkHaveAccount, getDyTokenByCas, startProcess, stopAllCrons, syncCrons } from './utils.js'

export interface WxjsxyPluginConfig {
  accounts: Record<string, {
    username: string
    password: string
  }>
  crons: Record<string, {
    cron: string
    offset: number
  }>
}

export const plugin = new Plugin<WxjsxyPluginConfig>(PackageJson.name)
  .setDefaultConfig([
    {
      key: 'accounts',
      val: {},
      comment: '账号信息，key为用户id，value为账号信息',
    },
    {
      key: 'crons',
      val: {},
      comment: '定时任务信息，key为用户id，value为定时任务信息',
    },
  ])
  .onInstall(async ({ config, bot, saveConfig, logger }) => {
    await syncCrons(config, bot, saveConfig, logger)
  })
  .onUninstall(() => {
    stopAllCrons()
  })

export const addAccountCommand = plugin
  .command('wxjsxy添加账号')
  .commander(yargs =>
    yargs()
      .option('username', {
        alias: 'u',
        type: 'string',
        description: '账号',
      })
      .option('password', {
        alias: 'p',
        type: 'string',
        description: '密码',
      }),
  )
  .callback(async ({ context, options, config, bot, saveConfig }) => {
    if (checkHaveAccount(config, context.user_id.toString())[0]) {
      await bot.sendMsg(context, [Structs.text('账号已存在，无需重复添加')])
      return
    }

    let { username, password } = options

    if (!username) {
      await bot.sendMsg(context, [Structs.text('请输入账号(学号):')])
      const msg = await bot.useMessage(context)
      if (!msg) {
        return
      }
      username = msg.raw_message.trim()
    }

    if (!password) {
      await bot.sendMsg(context, [Structs.text('请输入密码(Wxjsxy@身份证后六位):')])
      const msg = await bot.useMessage(context)
      if (!msg) {
        return
      }
      password = msg.raw_message.trim()
    }

    const casInfo = await loginToCas({ username, password })
    if (!('ticket' in casInfo)) {
      await bot.sendMsg(context, [Structs.text(`登录失败，请检查账号密码是否正确: \n ${JSON.stringify(casInfo)}`)])
    }

    await bot.sendMsg(context, [Structs.text(`登录成功, 返回信息: \n ${JSON.stringify(casInfo)}`)])

    config.accounts[context.user_id.toString()] = {
      username,
      password,
    }

    await saveConfig()
  })

export const deleteAccountCommand = plugin
  .command('wxjsxy删除账号')
  .callback(async ({ context, config, bot, saveConfig }) => {
    const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
    if (!haveAccount) {
      await bot.sendMsg(context, errorMsg)
      return
    }

    delete config.accounts[context.user_id.toString()]
    delete config.crons[context.user_id.toString()]
    removeCronJob(`wxjsxy_cron_${context.user_id}`)
    await saveConfig()
    await bot.sendMsg(context, [Structs.text('账号删除成功')])
  })

export const startProcessCommand = plugin
  .command('wxjsxy请假')
  .commander(yargs =>
    yargs()
      .option('offset', {
        alias: 'o',
        type: 'number',
        description: '请假日期相对于今天的偏移，默认为0即请假当天',
      }),
  )
  .callback(async ({ context, options, config, bot }) => {
    const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
    if (!haveAccount) {
      await bot.sendMsg(context, errorMsg)
      return
    }

    let { offset } = options
    if (!offset) {
      await bot.sendMsg(context, [Structs.text('请输入请假日期相对于今天的偏移，默认为0即请假当天:')])

      const msg = await bot.useMessage(context)
      if (!msg) {
        return
      }

      offset = Number.parseInt(msg.raw_message.trim())
      if (Number.isNaN(offset)) {
        await bot.sendMsg(context, [Structs.text('偏移必须是一个数字')])
        return
      }
    }

    const msg = await startProcess(config.accounts[context.user_id.toString()], offset)
    await bot.sendMsg(context, msg)
  })

export async function getProcessList(req: LoginToCasReq, data: getDyProcessReq) {
  const dyTokenRes = await getDyTokenByCas(req)
  if (Array.isArray(dyTokenRes)) {
    return dyTokenRes
  }

  const processList = await getDyProcessList(dyTokenRes, data)
  if (processList.code !== 200) {
    return [Structs.text(`获取请假情况失败, 错误信息: ${JSON.stringify(processList)}`)]
  }

  const processDetailList = await Promise.all(processList.rows.map(item => getDyProcessDetail(dyTokenRes, item.instanceId)))
  if (processDetailList.some(item => item.code !== 200)) {
    return [Structs.text(`获取请假详情失败, 错误信息: ${JSON.stringify(processDetailList)}`)]
  }

  return [
    Structs.text(`请假情况:\n`),
    Structs.text(
      processList.rows
        .map(
          (item, index) => {
            const strArr = [
              `- 申请时间: ${item.processStartTime}`,
              `  审核状态: ${item.approvaState}`,
            ]

            const detail = processDetailList[index]
            if (detail.code !== 200) {
              strArr.push(`  获取详情失败: ${JSON.stringify(detail)}`)
              return strArr.join('\n')
            }

            strArr.push(
              `  申请时间: ${detail.rows.hisTasks[1].processStartTime}`,
              ...detail.rows.hisTasks[1].formSchema.formProperties.map(prop => `  ${prop.name}: ${prop.value}`),
            )

            return strArr.join('\n')
          },
        )
        .join(''),
    ),
  ]
}

export const getProcessListCommand = plugin
  .command('wxjsxy请假情况')
  .commander(yargs =>
    yargs()
      .option('page', {
        alias: 'p',
        type: 'number',
        description: '页码',
        default: 1,
      })
      .option('size', {
        alias: 's',
        type: 'number',
        description: '每页数量',
        default: 1,
      }),
  )
  .callback(async ({ context, options, config, bot }) => {
    const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
    if (!haveAccount) {
      await bot.sendMsg(context, errorMsg)
      return
    }

    const msg = await getProcessList(config.accounts[context.user_id.toString()], { pageNo: options.page, pageSize: options.size })
    await bot.sendMsg(context, msg)
  })

export const cronStartProcessCommand = plugin
  .command('wxjsxy定时请假')
  .commander(yargs =>
    yargs()
      .option('cron', {
        alias: 'c',
        type: 'string',
        description: 'cron表达式',
      })
      .option('offset', {
        alias: 'o',
        type: 'number',
        description: '请假日期相对于今天的偏移，默认为0即请假当天',
      }),
  )
  .callback(async ({ context, options, config, bot, saveConfig, logger }) => {
    const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
    if (!haveAccount) {
      await bot.sendMsg(context, errorMsg)
      return
    }

    if (config.crons[context.user_id.toString()]) {
      await bot.sendMsg(context, [Structs.text('已存在定时请假任务')])
      return
    }

    let { cron, offset } = options
    if (!cron) {
      await bot.sendMsg(context, [Structs.text('请输入cron表达式:'), Structs.text('cron表达式格式必须为6段，示例: 0 30 6 * * * 表示每天6点30分')])
      const msg = await bot.useMessage(context)
      if (!msg) {
        return
      }
      cron = msg.raw_message.trim()
      if (cron.split(' ').length !== 6) {
        await bot.sendMsg(context, [Structs.text('cron表达式格式错误，请提供6段表达式.')])
        return
      }
    }

    if (!offset) {
      await bot.sendMsg(context, [Structs.text('请输入请假日期相对于今天的偏移，默认为0即请假当天:')])
      const msg = await bot.useMessage(context)
      if (!msg) {
        return
      }
      offset = Number.parseInt(msg.raw_message.trim())
      if (Number.isNaN(offset)) {
        await bot.sendMsg(context, [Structs.text('偏移必须是一个数字')])
        return
      }
    }

    // 判断是否为好友
    const isFriend = await bot.isFriend({ user_id: context.user_id })
    if (!isFriend) {
      await bot.sendMsg(context, [Structs.text('请先添加好友，才能设置定时请假哦')])
      return
    }

    config.crons[context.user_id.toString()] = {
      cron,
      offset,
    }

    await saveConfig()
    await syncCrons(config, bot, saveConfig, logger)
    await bot.sendMsg(context, [Structs.text('定时请假设置成功')])
  })

export const cronStopProcessCommand = plugin
  .command('wxjsxy取消定时请假')
  .callback(async ({ context, config, bot, saveConfig, logger }) => {
    const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
    if (!haveAccount) {
      await bot.sendMsg(context, errorMsg)
      return
    }

    if (!config.crons[context.user_id.toString()]) {
      await bot.sendMsg(context, [Structs.text('没有定时请假任务可供取消')])
      return
    }

    delete config.crons[context.user_id.toString()]
    await saveConfig()
    await syncCrons(config, bot, saveConfig, logger)
    await bot.sendMsg(context, [Structs.text('定时请假取消成功')])
  })
