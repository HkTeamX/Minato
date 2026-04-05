import type { ATRI, Bot } from '@atri-bot/core'
import type { TextSegment } from 'node-napcat-ts'
import type { LoginToCasReq } from './api.js'
import type { WxjsxyPluginConfig } from './plugin.js'
import { addCronJob, getCronJob, getCronJobs, removeCronJob } from '@atri-bot/lib-cron'
import dayjs from 'dayjs'
import { Structs } from 'node-napcat-ts'
import { getCasLoginToken, getDyCookie, getDyToken, loginToCas, setDyProcess } from './api.js'

export function checkHaveAccount(config: WxjsxyPluginConfig, userId: string): [false, TextSegment[] ] | [true, null] {
  if (!config.accounts[userId]) {
    return [false, [Structs.text('请先添加账号，使用命令：wxjsxy添加账号')]]
  }
  return [true, null]
}

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

export async function startProcess(req: LoginToCasReq, offset: number): Promise<TextSegment[]> {
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

export async function syncCrons(config: WxjsxyPluginConfig, bot: Bot, saveConfig: () => Promise<void>, logger: ATRI['logger']) {
  stopAllCrons()

  for (const [user_id, cronInfo] of Object.entries(config.crons)) {
    if (getCronJob(`wxjsxy_cron_${user_id}`)) {
      removeCronJob(`wxjsxy_cron_${user_id}`)
    }

    addCronJob({
      name: `wxjsxy_cron_${user_id}`,
      cronTime: cronInfo.cron,
      onTick: async () => {
        const [haveAccount, _] = checkHaveAccount(config, user_id.toString())

        if (!haveAccount) {
          logger.WARN(`用户 ${user_id} 的账号信息有误，无法执行定时请假任务，已自动删除定时任务`)
          delete config.crons[user_id]
          await saveConfig()
        }

        const msg = await startProcess(config.accounts[user_id], cronInfo.offset)
        await bot.sendMsg({ message_type: 'private', user_id: Number.parseFloat(user_id) }, msg)
      },
    })
  }
}

export function stopAllCrons() {
  for (const [name, _] of Object.entries(getCronJobs())) {
    if (name.startsWith('wxjsxy_cron_')) {
      removeCronJob(name)
    }
  }
}
