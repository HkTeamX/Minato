import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'
import packageJson from '../package.json' with { type: 'json' }

export const VERSION_KEY = Symbol('@minato-bot/atri-bot-plugin-gugu:db-version')

export interface GlobalWithVersion {
  [VERSION_KEY]: string | undefined
}

const DB_SCHEMA_VERSION = packageJson.version

export interface PigeonsAttributes {
  user_id: number
  pigeon_num: number
  created_at?: Date
  updated_at?: Date
}

export type PigeonsCreationAttributes = Optional<PigeonsAttributes, 'created_at' | 'updated_at'>

export class Pigeons
  extends Model<PigeonsAttributes, PigeonsCreationAttributes>
  implements PigeonsAttributes
{
  declare user_id: number
  declare pigeon_num: number

  declare readonly created_at: Date
  declare readonly updated_at: Date
}

export interface PigeonHistoriesAttributes {
  id: number
  user_id: number
  operation: number
  prev_num: number
  current_num: number
  reason: string

  created_at?: Date
  updated_at?: Date
}

export type PigeonHistoriesCreationAttributes = Optional<
  PigeonHistoriesAttributes,
  'id' | 'created_at' | 'updated_at'
>

export class PigeonHistories
  extends Model<PigeonHistoriesAttributes, PigeonHistoriesCreationAttributes>
  implements PigeonHistoriesAttributes
{
  declare id: number
  declare user_id: number
  declare operation: number
  declare prev_num: number
  declare current_num: number
  declare reason: string

  declare readonly created_at: Date
  declare readonly updated_at: Date
}

export const initDb = async (sequelize: Sequelize, ignoreVersion = false) => {
  if (!ignoreVersion) {
    // 检查全局版本标志位
    const global = globalThis as unknown as GlobalWithVersion
    const globalVersion = global[VERSION_KEY]

    if (globalVersion && globalVersion !== DB_SCHEMA_VERSION) {
      throw new Error(
        `数据库版本冲突！检测到多个版本的 @minato-bot/atri-bot-plugin-gugu 同时运行。\n` +
          `已初始化版本: ${globalVersion}\n` +
          `当前版本: ${DB_SCHEMA_VERSION}\n` +
          `请确保所有依赖此插件的插件都使用最新版本。`,
      )
    }

    // 标记当前版本
    global[VERSION_KEY] = DB_SCHEMA_VERSION
  }

  Pigeons.init(
    {
      user_id: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        primaryKey: true,
      },
      pigeon_num: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: 'pigeons',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  )

  PigeonHistories.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      operation: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      prev_num: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      current_num: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'pigeon_histories',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  )

  await sequelize.sync()
}
