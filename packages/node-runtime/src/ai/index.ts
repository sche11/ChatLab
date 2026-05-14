/**
 * AI 模块（Node.js 实现）
 *
 * 助手/技能 MD 文件解析器和共享类型。
 */

export type { AssistantConfig, AssistantSummary, SkillDef, SkillSummary } from './types'
export { parseAssistantFile, serializeAssistant } from './assistant-parser'
export { parseSkillFile, extractSkillId } from './skill-parser'
