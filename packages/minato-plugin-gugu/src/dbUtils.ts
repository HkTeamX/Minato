import type { InferSelectModel } from 'drizzle-orm'
import path from 'node:path'
import process from 'node:process'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { Relations, Schema } from './db.js'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 环境变量未设置, 请设置 DATABASE_URL 环境变量以连接数据库')
}

export const Drizzle = drizzle(process.env.DATABASE_URL, {
  schema: Schema,
  relations: Relations,
})

export async function migrateDrizzle() {
  await migrate(Drizzle, {
    migrationsFolder: path.join(import.meta.dir, '../drizzle'),
    migrationsTable: 'gugu_drizzle_migrations',
  })
}

export async function getUserPigeonInfo(user_id: number): Promise<InferSelectModel<typeof Schema.Pigeons>> {
  const pigeonInfo = await Drizzle.query.Pigeons.findFirst({ where: { user_id } })
  if (pigeonInfo) {
    return pigeonInfo
  }
  await Drizzle.insert(Schema.Pigeons).values({ user_id, pigeon_num: 0 })
  return await getUserPigeonInfo(user_id)
}

export async function addUserPigeonNum(user_id: number, addNum: number, reason: string) {
  const pigeonInfo = await getUserPigeonInfo(user_id)
  if (addNum < 0) {
    return false
  }

  await Drizzle.update(Schema.Pigeons)
    .set({ pigeon_num: pigeonInfo.pigeon_num + addNum })
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
