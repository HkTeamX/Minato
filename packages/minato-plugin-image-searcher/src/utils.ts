import type { AnimeTraceItem } from 'image_searcher'
import type { ImageSearcherConfig } from './config.js'
import { Buffer } from 'node:buffer'
import { useRequest } from '@atri-bot/lib-request'
import { addUserPigeonNum, reduceUserPigeonNum } from '@minato-bot/plugin-gugu'
import { AnimeTrace, Ascii2d, Iqdb, IqdbServicesPresets, SauceNAO, TinEye, TraceMoe } from 'image_searcher'
import { Jimp } from 'jimp'
import { Structs } from 'node-napcat-ts'

const bannedHosts = ['danbooru.donmai.us', 'konachan.com', 'fanbox.cc', 'pixiv.net']

/**
 * 链接混淆
 * @param url 链接
 * @param force 是否开启强制处理
 * @returns 处理后的链接
 */
export function confuseURL(url: string, force = false) {
  if (force) {
    const host = url.match('(http|https)://(.*)/')
    if (!host)
      return url
    return url.replace('//', '//\u200B').replace(host[2], host[2].replace(/\./g, '.\u200B'))
  }
  else {
    for (const host of bannedHosts) {
      if (url.includes(host)) {
        return url.replace('//', '//\u200B').replace(host, host.replace(/\./g, '.\u200B'))
      }
    }
  }

  return url
}

/**
 * 格式化时间,将秒转换为HH:MM:SS的格式
 * @param ms 毫秒
 * @returns HH:MM:SS
 */
export function formatTime(ms: number) {
  // 使用 padStart 方法补零
  const totalSeconds = Math.floor(ms / 1000) // 毫秒转秒
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  // 返回 HH:MM:SS 的字符串
  return `${hours}:${minutes}:${seconds}`
}

const bufferGetter = useRequest({
  headers: {
    'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'sec-ch-ua-platform': '"Windows"',
  },
})

export async function getImageBuffer(imageUrl: string) {
  const response = await bufferGetter.get(imageUrl)
  return Buffer.from(await response.arrayBuffer())
}

export async function cropImage(imageBuffer: Buffer, response: AnimeTraceItem[]) {
  const image = await Jimp.read(imageBuffer)
  const width = image.width
  const height = image.height

  const base64: string[] = []
  for (let i = 0; i < response.length; i++) {
    const box = response[i].box
    // 裁切图片
    const newImage = image.clone()
    newImage.crop({
      x: width * box[0],
      y: height * box[1],
      w: width * (box[2] - box[0]),
      h: height * (box[3] - box[1]),
    })
    const b64 = await newImage.getBase64('image/png')
    base64.push(b64.split(',')[1])
  }

  return base64
}

export function buildRequestParams(user_id: number, url: string, config: ImageSearcherConfig) {
  return ([
    async () => {
      if (!config.engines.Ascii2d.flareSolverr) {
        return Structs.customNode([
          Structs.text('Ascii2d 搜索失败: flareSolverr 配置项未设置'),
        ])
      }

      if (!(await reduceUserPigeonNum(user_id, config.engines.Ascii2d.reduce, 'Ascii2d 搜索'))) {
        return Structs.customNode([
          Structs.text('Ascii2d 搜索失败: 鸽子不足'),
        ])
      }

      try {
        const result = await Ascii2d({
          url,
          type: 'color',
          image2Base64: true,
          flareSolverr: config.engines.Ascii2d.flareSolverr,
        })
        return Structs.customNode([
          Structs.text('Ascii2d 搜索结果:'),
          ...result.results
            .slice(0, config.engines.Ascii2d.limit)
            .flatMap((item) => {
              return [
                Structs.image(`base64://${item.base64.split(',')[1]}`),
                Structs.text([
                  `图片信息: ${item.info}`,
                  `链接:
  - ${item.source?.text ?? '未知'}
  - ${item.source?.link ?? '未知'}`,
                  `作者:
  - ${item.author?.text ?? '未知'}
  - ${item.author?.link ?? '未知'}`,
                ].join('\n')),
              ]
            }),
        ])
      }
      catch (error) {
        // 搜索失败，退还鸽子
        await addUserPigeonNum(user_id, config.engines.Ascii2d.reduce, 'Ascii2d 搜索 失败退还')
        return Structs.customNode([
          Structs.text(`Ascii2d 搜索失败: ${error instanceof Error ? error.message : String(error)}`),
        ])
      }
    },
    async () => {
      if (!(await reduceUserPigeonNum(user_id, config.engines.SauceNAO.reduce, 'SauceNAO 搜索'))) {
        return Structs.customNode([
          Structs.text('SauceNAO 搜索失败: 鸽子不足'),
        ])
      }

      try {
        const result = await SauceNAO({
          url,
          hide: 0,
        })
        return Structs.customNode([
          Structs.text('SauceNAO 搜索结果:'),
          ...result
            .slice(0, config.engines.SauceNAO.limit)
            .flatMap((item) => {
              return [
                Structs.image(item.image),
                Structs.text([
                  `标题: ${item.title}`,
                  `相似度: ${item.similarity}`,
                  ...(
                    item.previews.length > 0
                      ? [
                          `图片预览链接:`,
                          item.previews
                            .map(preview => `- ${preview.name}
  - ${preview.link}`)
                            .join('\n'),
                        ]
                      : []),
                  ...(
                    item.sources.length > 0
                      ? [
                          `图片来源链接:`,
                          item.sources
                            .map(source =>
                              `- ${source.title}:
  - ${source.content?.text ?? '未知'}
  - ${source.content?.link ?? '未知'}`,
                            )
                            .join('\n'),
                        ]
                      : []
                  ),
                ].join('\n')),
              ]
            }),
        ])
      }
      catch (error) {
        // 搜索失败，退还鸽子
        await addUserPigeonNum(user_id, config.engines.SauceNAO.reduce, 'SauceNAO 搜索 失败退还')
        return Structs.customNode([
          Structs.text(`SauceNAO 搜索失败: ${error instanceof Error ? error.message : String(error)}`),
        ])
      }
    },
    async () => {
      if (!(await reduceUserPigeonNum(user_id, config.engines.Iqdb.reduce, 'Iqdb 搜索'))) {
        return Structs.customNode([
          Structs.text('Iqdb 搜索失败: 鸽子不足'),
        ])
      }

      try {
        const result = await Iqdb({
          url,
          forcegray: true,
          service: IqdbServicesPresets.anime,
        })
        return Structs.customNode([
          Structs.text('Iqdb 搜索结果:'),
          ...result
            .slice(0, config.engines.Iqdb.limit)
            .flatMap((item) => {
              return [
                Structs.image(item.image),
                Structs.text([
                  `相似度: ${item.similarity}%`,
                  `分辨率: ${item.resolution}`,
                  `来源:`,
                  item.sources.map(source =>
                    `- ${source.name}(${source.url})`)
                    .join('\n'),
                ].join('\n')),
              ]
            }),
        ])
      }
      catch (error) {
        // 搜索失败，退还鸽子
        await addUserPigeonNum(user_id, config.engines.Iqdb.reduce, 'Iqdb 搜索 失败退还')
        return Structs.customNode([
          Structs.text(`Iqdb 搜索失败: ${error instanceof Error ? error.message : String(error)}`),
        ])
      }
    },
    async () => {
      if (!(await reduceUserPigeonNum(user_id, config.engines.TraceMoe.reduce, 'TraceMoe 搜索'))) {
        return Structs.customNode([
          Structs.text('TraceMoe 搜索失败: 鸽子不足'),
        ])
      }

      const result = await TraceMoe({
        url,
        cutBorders: true,
      })

      return Structs.customNode([
        Structs.text('TraceMoe 搜索结果:'),
        ...result
          .slice(0, config.engines.TraceMoe.limit)
          .flatMap((item) => {
            return [
              Structs.image(item.image),
              Structs.text([
                `预览视频: ${item.video ?? '无'}`,
                `相似度: ${item.similarity}%`,
                `文件名: ${item.filename}`,
                `集数: ${item.episode ?? '未知'}`,
                `大概位置: ${formatTime(item.from)}——${formatTime(item.to)}`,
              ].join('\n')),
            ]
          }),
      ])
    },
    async () => {
      if (!(await reduceUserPigeonNum(user_id, config.engines.AnimeTrace.reduce, 'AnimeTrace 搜索'))) {
        return Structs.customNode([
          Structs.text('AnimeTrace 搜索失败: 鸽子不足'),
        ])
      }

      const result = await AnimeTrace({
        url,
        is_multi: 0,
        ai_detect: 0,
        model: 'animetrace_high_beta',
      })
      const boxes = await cropImage(await getImageBuffer(url), result)
      return Structs.customNode([
        Structs.text('AnimeTrace 搜索结果:'),
        ...result
          .slice(0, config.engines.AnimeTrace.limit)
          .flatMap((item, index) => {
            return [
              boxes[index] ? Structs.image(`base64://${boxes[index]}`) : Structs.text('获取图片预览失败喵~'),
              Structs.text(
                item.character.slice(0, config.engines.AnimeTrace.limit)
                  .flatMap(char => [
                    `角色名: ${char.character}`,
                    `动漫名: ${char.work}`,
                  ])
                  .join('\n'),
              ),
            ]
          }),
      ])
    },
    async () => {
      if (!(await reduceUserPigeonNum(user_id, config.engines.TinEye.reduce, 'TinEye 搜索'))) {
        return Structs.customNode([
          Structs.text('TinEye 搜索失败: 鸽子不足'),
        ])
      }

      const result = await TinEye({
        url,
      })

      return Structs.customNode([
        Structs.text('TinEye 搜索结果:'),
        ...result
          .slice(0, config.engines.TinEye.limit)
          .flatMap((item) => {
            return [
              Structs.image(item.image),
              Structs.text([
                `相似度: ${item.similarity}`,
                `分辨率: ${item.resolution}`,
                `来源:`,
                item.sources
                  .map(source => `- ${confuseURL(source.link)}`)
                  .join('\n'),
              ].join('\n')),
            ]
          }),
      ])
    },
  ])
    .map(fn => fn())
}
