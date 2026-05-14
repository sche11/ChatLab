/**
 * 预处理管道 — 薄包装
 *
 * 实际实现已提取到 @openchatlab/node-runtime。
 * 此处注入 Electron 端的 aiLogger 作为默认 logger。
 */

import type { PreprocessableMessage, PreprocessConfig } from './types'
import { preprocessMessages as sharedPreprocessMessages } from '@openchatlab/node-runtime'
import { aiLogger } from '../logger'

const electronLogger = {
  info: (category: string, message: string, extra?: Record<string, unknown>) => aiLogger.info(category, message, extra),
  warn: (category: string, message: string, extra?: Record<string, unknown>) => aiLogger.warn(category, message, extra),
}

export function preprocessMessages<T extends PreprocessableMessage>(messages: T[], config?: PreprocessConfig): T[] {
  return sharedPreprocessMessages(messages, config, electronLogger)
}
