import crypto from 'node:crypto'
import { useRequest } from '@atri-bot/lib-request'
// @ts-expect-error 这个库没有类型声明文件
import { encryptedString, RSAKeyPair, setMaxDigits } from './lib.js'

setMaxDigits(131)
const exponentHex = '010001'
const modulusHex = '00b5eeb166e069920e80bebd1fea4829d3d1f3216f2aabe79b6c47a3c18dcee5fd22c2e7ac519cab59198ece036dcf289ea8201e2a0b9ded307f8fb704136eaeb670286f5ad44e691005ba9ea5af04ada5367cd724b5a26fdb5120cc95b6431604bd219c6b7d83a6f8f24b43918ea988a76f93c333aa5a20991493d4eb1117e7b1'
const key = new RSAKeyPair(exponentHex, '', modulusHex)

export const casReq = useRequest({
  throwHttpErrors: false,
  headers: {
    'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded',
    'sec-ch-ua-platform': '"Windows"',
  },
})

export const dyReq = useRequest({
  headers: {
    'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'sec-ch-ua-platform': '"Windows"',
    'mode': 'wxa',
    'Content-Type': 'application/json',
  },
})

export interface LoginToCasReq {
  username: string
  password: string
}

export type LoginToCasRes
  = | { meta: { success: false, statusCode: 500, message: '请求操作失败!' }, data: null }
    | { meta: { success: true, statusCode: 200, message: 'ok' }, data: { code: 'PASSERROR', data: '10,1' } }
    | { meta: { success: true, statusCode: 200, message: 'ok' }, data: { code: 'NOUSER' } }
    | { tgt: string, ticket: string }

export async function loginToCas(req: LoginToCasReq): Promise<LoginToCasRes> {
  const { username, password } = req
  return await casReq.post('https://cas.wxjsxy.com.cn/lyuapServer/v1/tickets', {
    body: new URLSearchParams({
      username,
      password: encryptedString(key, password),
      service: 'https://portal.wxjsxy.com.cn/',
      loginType: '',
      id: '',
      code: '',
      otpcode: '',
    }),
  }).json()
}

export async function getCasLoginToken(TGT: string): Promise<[boolean, string]> {
  const res = await casReq.post(`https://cas.wxjsxy.com.cn/lyuapServer/v1/tickets/${TGT}`, {
    body: new URLSearchParams({
      service: 'https://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/index',
      loginToken: 'loginToken',
    }),
  }).text()

  return [res.startsWith('ST-'), res]
}

export async function getDyCookie(CasToken: string): Promise<string | null> {
  const result = await casReq.get(`https://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/index?ticket=${CasToken}`, {
    redirect: 'manual',
  })
  const setCookie = result.headers.getSetCookie()
  if (setCookie.length === 0) {
    return null
  }
  return setCookie.map(cookie => `${cookie.split(';')[0]};`).join('')
}

export type GetDyTokenRes
  = | { msg: '操作成功', code: 200, user: null, token: null }
    | {
      msg: '操作成功'
      code: 200
      user: {
        name: string
        orgName: string /* 系部 */
        professionName: string /* 学科 */
        certificateNum: string /* 身份证 */
        phone: string /* 电话 */
        className: string /* 班级 */
      }
      token: string
    }

export async function getDyToken(cookie: string): Promise<GetDyTokenRes> {
  return await dyReq.get('https://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/indexData', {
    headers: {
      cookie,
    },
  }).json()
}

export interface SetDyProcessReq {
  beginTime: string
  endTime: string
  leaveSchool: '是' | '否'
  backDormitory: '是' | '否'
  askedType: '事假' | '病假'
  reason: string
}

export type SetDyProcessRes
  = | { msg: string, code: 500 }
    | { msg: string, code: 200, rows: string }

export async function setDyProcess(token: string, req: SetDyProcessReq): Promise<SetDyProcessRes> {
  const data = {
    ...req,
    processDefinitionKey: 'studentApply',
  }
  const sign = crypto.createHash('md5').update(`myappsecret${JSON.stringify(data)}myappsecret`).digest('hex')
  return await dyReq.post(`https://dy.wxjsxy.com.cn/prdapi/activiti/processInstance/startProcess?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}&sign=${sign}`, {
    json: data,
    headers: {
      token,
      sign,
      timestamp: Date.now().toString(),
    },
  }).json()
}

export interface getDyProcessReq {
  pageNo: number
  pageSize: number
}

export interface DyProcessItem {
  id: string
  assignee: null
  decId: null
  textValue: null
  owner: string
  name: string
  startTime: string
  endTime: string
  deleteReason: null
  executionId: string
  instanceId: string
  taskDefinitionKey: string
  processDefinitionId: string
  description: null
  processStartTime: string
  processEndTime: string
  startUserId: string
  startUserSex: string
  startUserPhoto: null
  startUserType: string
  processName: string
  formSchema: null
  customProperties: null
  deploymentId: string
  resourceName: string
  handerUsers: null
  approvaState: '已通过' | '审核中'
  applyUserName: null
  applyUserId: null
  titleContent: null
}

export type DyProcessRes
  = | { msg: string, code: 500 }
    | {
      offset: number
      limit: number
      code: 200
      msg: '操作成功!'
      pageNo: number
      pageSize: number
      rows: DyProcessItem[]
      total: number
      totalPages: number
      maxId: null
      map: null
      first: number
    }

export async function getDyProcessList(token: string, data: getDyProcessReq = { pageNo: 1, pageSize: 1 }): Promise<DyProcessRes> {
  const sign = crypto.createHash('md5').update(`myappsecret${JSON.stringify(data)}myappsecret`).digest('hex')
  return await dyReq.post(`https://dy.wxjsxy.com.cn/prdapi/activiti/task/myapply?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}&sign=${sign}`, {
    json: data,
    headers: {
      token,
      sign,
      timestamp: Date.now().toString(),
    },
  }).json()
}

export type DyProcessDetailRes
  = | { msg: string, code: 500 }
    | {
      code: 200
      msg: '操作成功'
      rows: {
        approveState: '已通过' | '审核中'
        hisTasks: [
          null,
          {
            processStartTime: string
            formSchema: {
              formProperties: {
                id: 'begineTime' | 'endTime' | 'leaveSchool' | 'backDormitory' | 'askedType' | 'reason'
                value: string
                name: string
              }[]
            }
          },
        ]
      }
    }

export async function getDyProcessDetail(token: string, instanceId: string): Promise<DyProcessDetailRes> {
  const data = { instanceId }
  const sign = crypto.createHash('md5').update(`myappsecret${JSON.stringify(data)}myappsecret`).digest('hex')
  return await dyReq.post(`https://dy.wxjsxy.com.cn/prdapi/activiti/task/done/info/byInstanceId?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}&sign=${sign}`, {
    json: data,
    headers: {
      token,
      sign,
      timestamp: Date.now().toString(),
    },
  }).json()
}
