/**
 * AI 模块（Node.js 实现）
 *
 * 助手/技能 MD 文件解析器、共享类型、对话管理。
 */

export type { AssistantConfig, AssistantSummary, SkillDef, SkillSummary } from './types'
export { parseAssistantFile, serializeAssistant } from './assistant-parser'
export { parseSkillFile, extractSkillId } from './skill-parser'
export { AIConversationManager } from './conversations'
export type {
  AIConversation,
  AIMessage,
  AIMessageRole,
  ContentBlock,
  TokenUsageData,
  ConversationManagerLogger,
} from './conversations'

// Tokenizer
export { countTokens, countMessagesTokens } from './tokenizer'

// Preprocessor
export type {
  PreprocessConfig,
  PreprocessableMessage,
  DesensitizeRule,
  TruncationStrategy,
  PreprocessLogger,
} from './preprocessor'
export {
  preprocessMessages,
  BUILTIN_DESENSITIZE_RULES,
  getDefaultRulesForLocale,
  mergeRulesForLocale,
  formatMessageCompact,
  formatTimeRange,
  formatToolResultAsText,
  anonymizeMessageNames,
  truncateFormattedMessages,
  isChineseLocale,
  i18nTexts,
  t,
} from './preprocessor'
