import { defineRelations } from 'drizzle-orm'
import { bigint, bigserial, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const Pigeons = pgTable('pigeons', {
  user_id: bigserial('id', { mode: 'number' }).primaryKey(),
  pigeon_num: bigint('pigeon_num', { mode: 'number' }).notNull(),
  ...timestamps,
})

export const PigeonHistories = pgTable('pigeon_histories', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  user_id: bigserial('user_id', { mode: 'number' }).notNull(),
  operation: bigint('operation', { mode: 'number' }).notNull(),
  prev_num: bigint('prev_num', { mode: 'number' }).notNull(),
  current_num: bigint('current_num', { mode: 'number' }).notNull(),
  reason: text(),
  ...timestamps,
})

export const Schema = {
  Pigeons,
  PigeonHistories,
}

export const Relations = defineRelations(Schema, r => ({
  PigeonHistories: {
    Pigeon: r.one.Pigeons({
      from: r.PigeonHistories.user_id,
      to: r.Pigeons.user_id,
    }),
  },
}))
