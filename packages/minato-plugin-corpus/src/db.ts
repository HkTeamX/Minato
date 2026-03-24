import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'
import packageJson from '../package.json' with { type: 'json' }

export const VERSION_KEY = Symbol('@minato-bot/atri-bot-plugin-corpus:db-version')

export interface GlobalWithVersion {
  [VERSION_KEY]: string | undefined
}

const DB_SCHEMA_VERSION = packageJson.version

export interface CorpusAttributes {
  id?: number
  user_id: number
  keyword: string
  reply: string
  mode: '模糊' | '精准'
  scene: '全部' | '私聊' | '群聊'
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date | null
}

export type CorpusCreationAttributes = Optional<
  CorpusAttributes,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Corpus
  extends Model<CorpusAttributes, CorpusCreationAttributes>
  implements CorpusAttributes
{
  declare id: number
  declare user_id: number
  declare keyword: string
  declare reply: string
  declare mode: '模糊' | '精准'
  declare scene: '全部' | '私聊' | '群聊'

  declare readonly created_at: Date
  declare readonly updated_at: Date
  declare deleted_at: Date | null
}

export const initDb = async (sequelize: Sequelize, ignoreVersion = false) => {
  if (!ignoreVersion) {
    const global = globalThis as unknown as GlobalWithVersion
    const globalVersion = global[VERSION_KEY]

    if (globalVersion && globalVersion !== DB_SCHEMA_VERSION) {
      throw new Error(
        `数据库版本冲突！检测到多个版本的 @minato-bot/atri-bot-plugin-corpus 同时运行。\n` +
          `已初始化版本: ${globalVersion}\n` +
          `当前版本: ${DB_SCHEMA_VERSION}\n` +
          `请确保所有依赖此插件的插件都使用最新版本。`,
      )
    }

    global[VERSION_KEY] = DB_SCHEMA_VERSION
  }

  Corpus.init(
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
      keyword: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      reply: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      mode: {
        type: DataTypes.ENUM('模糊', '精准'),
        allowNull: false,
      },
      scene: {
        type: DataTypes.ENUM('全部', '私聊', '群聊'),
        allowNull: false,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'corpus',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: false,
    },
  )

  await sequelize.sync()
}
