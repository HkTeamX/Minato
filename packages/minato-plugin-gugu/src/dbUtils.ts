import type { InferSelectModel } from 'drizzle-orm'
import path from 'node:path'
import { useDb } from '@atri-bot/lib-db'
import { eq } from 'drizzle-orm'
import PackageJson from '../package.json' with { type: 'json' }
import { Relations, Schema } from './db.js'

// 内部私有变量，用于缓存实例
let _drizzle: Awaited<ReturnType<typeof useDb<typeof Schema, typeof Relations>>> | null = null

export async function getDrizzle() {
  if (!_drizzle) {
    _drizzle = await useDb({
      pluginName: PackageJson.name,
      config: {
        schema: Schema,
        relations: Relations,
      },
      migration: {
        migrationsFolder: path.join(import.meta.dir, '../drizzle'),
      },
    })
  }

  return _drizzle
}

export async function getUserPigeonInfo(user_id: number): Promise<InferSelectModel<typeof Schema.Pigeons>> {
  const Drizzle = await getDrizzle()
  const pigeonInfo = await Drizzle.query.Pigeons.findFirst({ where: { user_id } })
  if (pigeonInfo) {
    return pigeonInfo
  }
  await Drizzle.insert(Schema.Pigeons).values({ user_id, pigeon_num: 0 })
  return await getUserPigeonInfo(user_id)
}

export async function addUserPigeonNum(user_id: number, addNum: number, reason: string) {
  const Drizzle = await getDrizzle()

  const pigeonInfo = await getUserPigeonInfo(user_id)
  if (addNum < 0) {
    return false
  }

  await Drizzle.update(Schema.Pigeons)
    .set({ pigeon_num: pigeonInfo.pigeon_num + addNum, gugued: true })
    .where(eq(Schema.Pigeons.user_id, user_id))

  await Drizzle.insert(Schema.PigeonHistories).values({
    user_id,
    operation: addNum,
    prev_num: pigeonInfo.pigeon_num,
    current_num: pigeonInfo.pigeon_num + addNum,
    reason,
  })

  return true
}

export async function reduceUserPigeonNum(user_id: number, reduceNum: number, reason: string) {
  const Drizzle = await getDrizzle()

  const pigeonInfo = await getUserPigeonInfo(user_id)
  if (reduceNum <= 0 || pigeonInfo.pigeon_num - reduceNum < 0) {
    return false
  }

  await Drizzle.update(Schema.Pigeons)
    .set({ pigeon_num: pigeonInfo.pigeon_num - reduceNum })
    .where(eq(Schema.Pigeons.user_id, user_id))

  await Drizzle.insert(Schema.PigeonHistories).values({
    user_id,
    operation: reduceNum,
    prev_num: pigeonInfo.pigeon_num + reduceNum,
    current_num: pigeonInfo.pigeon_num,
    reason,
  })

  return true
}
