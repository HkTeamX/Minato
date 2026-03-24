import type { AllHandlers, FaceSegment, ImageSegment, Receive, TextSegment } from 'node-napcat-ts'

export interface CorpusPluginConfig {
  learnCost: number
  forgetCost: number
  timeout: number
}

export interface LearnState {
  step: 1 | 2 | 3
  mode: '模糊' | '精准'
  scene: '全部' | '私聊' | '群聊'
  timer: NodeJS.Timeout
  context: AllHandlers['message']
  keyword?: AllHandlers['message']
  reply?: AllHandlers['message']
}

export interface ForgetState {
  step: 1 | 2
  context?: AllHandlers['message']
  timer: NodeJS.Timeout
}

export interface LearnCorpusCommandContext {
  params: {
    mode: '模糊' | '精准'
    scene: '全部' | '私聊' | '群聊'
  }
}

export interface Rule {
  id: number
  user_id: number
  keyword: Receive[keyof Receive][]
  reply: (TextSegment | FaceSegment | ImageSegment)[]
  mode: '模糊' | '精准'
  scene: '全部' | '私聊' | '群聊'
}
