import CryptoJS from 'crypto-js'
import { type AxiosConfig, Axios } from '@atri-bot/lib-request'
// @ts-expect-error 函数来自老库
import { RSAKeyPair, setMaxDigits, encryptedString } from './lib.js'

setMaxDigits(131)

export class Api {
  axios: Axios

  constructor(config: AxiosConfig) {
    this.axios = new Axios(config)
  }

  exponentHex = '010001'
  modulusHex =
    '00b5eeb166e069920e80bebd1fea4829d3d1f3216f2aabe79b6c47a3c18dcee5fd22c2e7ac519cab59198ece036dcf289ea8201e2a0b9ded307f8fb704136eaeb670286f5ad44e691005ba9ea5af04ada5367cd724b5a26fdb5120cc95b6431604bd219c6b7d83a6f8f24b43918ea988a76f93c333aa5a20991493d4eb1117e7b1'
  key = new RSAKeyPair(this.exponentHex, '', this.modulusHex)

  loginToCas(
    username: string,
    password: string,
  ): Promise<{ data: { tgt: string; ticket: string } }> {
    return this.axios.post({
      url: 'https://cas.wxjsxy.com.cn/lyuapServer/v1/tickets',
      data: {
        username,
        password: encryptedString(this.key, password),
        service: 'https://portal.wxjsxy.com.cn/',
        loginType: '',
        id: '',
        code: '',
        otpcode: '',
      },
    })
  }

  getCasLoginToken(ticket: string): Promise<{ data: string }> {
    return this.axios.post({
      url: `https://cas.wxjsxy.com.cn/lyuapServer/v1/tickets/${ticket}`,
      data: {
        service: 'http://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/index',
        loginToken: 'loginToken',
      },
    })
  }

  async getDyCookie(ticket: string): Promise<string> {
    const result = await this.axios.get({
      url: `http://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/index?ticket=${ticket}`,
    })
    const setCookie = result.headers['set-cookie']
    if (!setCookie) throw new Error('Failed to get CAS cookie')
    return setCookie.map((cookie) => cookie.split(';')[0] + ';').join('')
  }

  getDyToken(cookie: string): Promise<{ data: { token: string } }> {
    return this.axios.get({
      url: 'http://dy.wxjsxy.com.cn/prdapi/wxjsxyapp/cas/indexData',
      headers: {
        cookie,
      },
    })
  }

  setDyProcess(
    token: string,
    beginTime: string,
    endTime: string,
    leaveSchool: '是' | '否',
    backDormitory: '是' | '否',
    askedType: '事假' | '病假' | '节假日',
    reason: string,
  ) {
    const data = {
      beginTime,
      endTime,
      leaveSchool,
      backDormitory,
      askedType,
      reason,
      processDefinitionKey: 'studentApply',
    }
    const sign = CryptoJS.MD5(`myappsecret${JSON.stringify(data)}myappsecret`).toString()
    return this.axios.post({
      url: `http://dy.wxjsxy.com.cn/prdapi/activiti/processInstance/startProcess?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}`,
      data,
      headers: {
        token,
        mode: 'wxa',
        sign,
        timestamp: new Date().getTime(),
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
    })
  }

  async getDyProcessList(token: string): Promise<{
    data: {
      rows: {
        approvaState: string
        processStartTime: string
        start_time: string
        end_time: string
      }[]
    }
  }> {
    const data = {
      pageNo: 1,
      pageSize: 5,
    }
    const sign = CryptoJS.MD5(`myappsecret${JSON.stringify(data)}myappsecret`).toString()
    const list = await this.axios.post<
      {
        rows: {
          approvaState: string
          processStartTime: string
          start_time: string
          end_time: string
        }[]
      },
      { pageNo: number; pageSize: number }
    >({
      url: `http://dy.wxjsxy.com.cn/prdapi/activiti/task/myapply?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}`,
      data,
      headers: {
        token,
        mode: 'wxa',
        sign,
        timestamp: new Date().getTime(),
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
    })

    for (const row of list.data.rows) {
      const data = {
        instanceId: 'eead9e3f-1df9-47f6-ad9e-3f1df9c7f6e9',
      }
      const sign = CryptoJS.MD5(`myappsecret${JSON.stringify(data)}myappsecret`).toString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await this.axios.post<any, any>({
        url: `http://dy.wxjsxy.com.cn/prdapi/activiti/task/done/info/byInstanceId?user_info_query_json=${encodeURIComponent(JSON.stringify(data))}`,
        data,
        headers: {
          token,
          mode: 'wxa',
          sign,
          timestamp: new Date().getTime(),
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
      })

      row['start_time'] =
        detail.data.rows.hisTasks?.[1]?.formSchema?.formProperties?.[0]?.value ?? '获取失败'
      row['end_time'] =
        detail.data.rows.hisTasks?.[1]?.formSchema?.formProperties?.[1]?.value ?? '获取失败'
    }

    return list
  }
}
