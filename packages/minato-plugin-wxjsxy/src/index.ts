import type { TextSegment } from 'node-napcat-ts'
import type { getDyProcessReq, LoginToCasReq } from './api.js'
import { Plugin } from '@atri-bot/core'
import { useCron } from '@atri-bot/lib-cron'
import dayjs from 'dayjs'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import PackageJson from '../package.json' with { type: 'json' }
import { getCasLoginToken, getDyCookie, getDyProcessDetail, getDyProcessList, getDyToken, loginToCas, setDyProcess } from './api.js'

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

export const AddAccountCommander = yargs()
  .option('username', {
    alias: 'u',
    type: 'string',
    description: '账号',
    demandOption: true,
  })
  .option('password', {
    alias: 'p',
    type: 'string',
    description: '密码',
    demandOption: true,
  })

export const startProcessCommander = yargs()
  .option('offset', {
    alias: 'o',
    type: 'number',
    description: '请假日期相对于今天的偏移，默认为0即请假当天',
    default: 0,
  })

export const getProcessListCommander = yargs()
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
  })

export const setCronProcessCommander = yargs()
  .option('cron', {
    alias: 'c',
    type: 'string',
    description: 'cron表达式',
    demandOption: true,
  })
  .option('offset', {
    alias: 'o',
    type: 'number',
    description: '请假日期相对于今天的偏移，默认为0即请假当天',
    default: 0,
  })

export async function getDyTokenByCas(req: LoginToCasReq): Promise<string | TextSegment[]> {
  const loginRes = await loginToCas(req)
  if (!('ticket' in loginRes)) {
    return [Structs.text(`请假失败, 登陆账号失败: ${JSON.stringify(loginRes)}`)]
  }

  const [loginTokenSuccess, loginTokenRes] = await getCasLoginToken(loginRes.tgt)
  if (!loginTokenSuccess) {
    return [Structs.text(`请假失败, 获取CasToken失败: ${loginTokenRes}`)]
  }

  const casCookie = await getDyCookie(loginTokenRes)
  if (!casCookie) {
    return [Structs.text(`请假失败, 获取DyCookie失败`)]
  }

  const dyTokenRes = await getDyToken(casCookie)
  if (!dyTokenRes.token) {
    return [Structs.text(`请假失败, 获取DyToken失败: ${JSON.stringify(dyTokenRes)}`)]
  }

  return dyTokenRes.token
}

export async function startProcess(req: LoginToCasReq, offset = 0) {
  const dyTokenRes = await getDyTokenByCas(req)
  if (Array.isArray(dyTokenRes)) {
    return dyTokenRes
  }

  const dyAction = await setDyProcess(
    dyTokenRes,
    {
      beginTime: dayjs().add(offset, 'day').hour(6).minute(30).format('YYYY-MM-DD HH:mm'),
      endTime: dayjs().add(offset, 'day').hour(20).minute(50).format('YYYY-MM-DD HH:mm'),
      leaveSchool: '是',
      backDormitory: '是',
      askedType: '事假',
      reason: '集训',
    },
  )
  if (dyAction.code !== 200) {
    return [Structs.text(`请假失败, 提交请假申请失败: ${JSON.stringify(dyAction)}`)]
  }

  return [Structs.text(`请假成功, 返回信息: \n ${JSON.stringify(dyAction)}`)]
}

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

export function checkHaveAccount(config: WxjsxyPluginConfig, userId: string): [false, TextSegment[] ] | [true, null] {
  if (!config.accounts[userId]) {
    return [false, [Structs.text('请先添加账号，使用命令：wxjsxy添加账号 -u <用户名> -p <密码>')]]
  }
  return [true, null]
}

export const plugin = new Plugin(PackageJson.name)
  .setDefaultConfig<WxjsxyPluginConfig>({
    accounts: {},
    crons: {},
  })
  .onInstall(async ({ event, config, atri, bot, saveConfig, logger }) => {
    const cron = useCron(atri)

    async function refreshCrons() {
      for (const [user_id, cronInfo] of Object.entries(config.crons)) {
        if (cron.getCronJob(`wxjsxy_cron_${user_id}`)) {
          cron.removeCronJob(`wxjsxy_cron_${user_id}`)
        }

        cron.addCronJob({
          name: `wxjsxy_cron_${user_id}`,
          cronTime: cronInfo.cron,
          onTick: async () => {
            const [haveAccount, _] = checkHaveAccount(config, user_id.toString())

            if (!haveAccount) {
              logger.WARN(`用户 ${user_id} 的账号信息有误，无法执行定时请假任务，已自动删除定时任务`, config, config.accounts[user_id], typeof user_id)
              delete config.crons[user_id]
              await saveConfig()
              return
            }

            const msg = await startProcess(config.accounts[user_id], cronInfo.offset)
            await bot.sendMsg({ message_type: 'private', user_id: Number.parseFloat(user_id) }, msg)
          },
        })
      }
    }

    await refreshCrons()

    event.regCommandEvent({
      trigger: 'wxjsxy添加账号',
      commander: AddAccountCommander,
      callback: async ({ context, options }) => {
        if (config.accounts[context.user_id]) {
          await bot.sendMsg(context, [Structs.text('账号已存在，无需重复添加')])
          return
        }

        const casInfo = await loginToCas({
          username: options.username,
          password: options.password,
        })
        if (!('ticket' in casInfo)) {
          await bot.sendMsg(context, [Structs.text(`登录失败，请检查账号密码是否正确: \n ${JSON.stringify(casInfo)}`)])
          return
        }

        await bot.sendMsg(context, [Structs.text(`登录成功, 返回信息: \n ${JSON.stringify(casInfo)}`)])

        config.accounts[context.user_id] = {
          username: options.username,
          password: options.password,
        }

        await saveConfig()
      },
    })

    event.regCommandEvent({
      trigger: 'wxjsxy删除账号',
      callback: async ({ context }) => {
        const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
        if (!haveAccount) {
          await bot.sendMsg(context, errorMsg)
          return
        }

        delete config.accounts[context.user_id]
        delete config.crons[context.user_id]
        cron.removeCronJob(`wxjsxy_cron_${context.user_id}`)
        await saveConfig()
        await bot.sendMsg(context, [Structs.text('账号删除成功')])
      },
    })

    event.regCommandEvent({
      trigger: 'wxjsxy请假',
      commander: startProcessCommander,
      callback: async ({ context, options }) => {
        const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
        if (!haveAccount) {
          await bot.sendMsg(context, errorMsg)
          return
        }

        const msg = await startProcess(config.accounts[context.user_id], options.offset)
        await bot.sendMsg(context, msg)
      },
    })

    event.regCommandEvent({
      trigger: 'wxjsxy请假情况',
      commander: getProcessListCommander,
      callback: async ({ context, options }) => {
        const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
        if (!haveAccount) {
          await bot.sendMsg(context, errorMsg)
          return
        }

        const msg = await getProcessList(config.accounts[context.user_id], { pageNo: options.page, pageSize: options.size })
        await bot.sendMsg(context, msg)
      },
    })

    event.regCommandEvent({
      trigger: 'wxjsxy定时请假',
      commander: setCronProcessCommander,
      callback: async ({ context, options }) => {
        const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
        if (!haveAccount) {
          await bot.sendMsg(context, errorMsg)
          return
        }

        if (config.crons[context.user_id]) {
          await bot.sendMsg(context, [Structs.text('已存在定时请假任务')])
          return
        }

        if (options.cron.split(' ').length !== 6) {
          await bot.sendMsg(context, [Structs.text('cron表达式格式错误，请提供6段表达式, 示例: 0 30 6 * * * 表示每天6点30分')])
          return
        }

        // 判断是否为好友
        const isFriend = await bot.isFriend({ user_id: context.user_id })
        if (!isFriend) {
          await bot.sendMsg(context, [Structs.text('请先添加好友，才能设置定时请假哦')])
          return
        }

        config.crons[context.user_id] = {
          cron: options.cron,
          offset: options.offset,
        }

        await saveConfig()
        await refreshCrons()
        await bot.sendMsg(context, [Structs.text('定时请假设置成功')])
      },
    })

    event.regCommandEvent({
      trigger: 'wxjsxy取消定时请假',
      callback: async ({ context }) => {
        const [haveAccount, errorMsg] = checkHaveAccount(config, context.user_id.toString())
        if (!haveAccount) {
          await bot.sendMsg(context, errorMsg)
          return
        }

        if (!config.crons[context.user_id]) {
          await bot.sendMsg(context, [Structs.text('没有定时请假任务可供取消')])
          return
        }

        delete config.crons[context.user_id]
        await saveConfig()
        await refreshCrons()
        await bot.sendMsg(context, [Structs.text('定时请假取消成功')])
      },
    })
  })
  .onUninstall(({ atri }) => {
    const cron = useCron(atri)

    const cronsEntries = Object.entries(cron.getCronJobs())
    for (const [name, _] of cronsEntries) {
      if (name.startsWith('wxjsxy_cron_')) {
        cron.removeCronJob(name)
      }
    }
  })
