/**
 * 工具结果格式化 & i18n 辅助（平台无关）
 *
 * 从 @openchatlab/node-runtime 复制核心子集，避免引入 node-runtime 重依赖。
 */

export function isChineseLocale(locale?: string): boolean {
  return locale?.startsWith('zh') ?? false
}

export const i18nTexts = {
  allTime: { zh: '全部时间', en: 'All time' },
  noContent: { zh: '[无内容]', en: '[No content]' },
  memberNotFound: { zh: '未找到该成员', en: 'Member not found' },
  untilNow: { zh: '至今', en: 'Present' },
  noChangeRecord: { zh: '无变更记录', en: 'No change record' },
  noConversation: { zh: '未找到这两人之间的对话', en: 'No conversation found between these two members' },
  noMessageContext: { zh: '未找到指定的消息或上下文', en: 'Message or context not found' },
  messages: { zh: '条', en: '' },
  alias: { zh: '别名', en: 'Alias' },
}

type TextEntryKey = keyof typeof i18nTexts

export function t(key: TextEntryKey, locale?: string): string {
  const text = i18nTexts[key]
  if (typeof text === 'object' && 'zh' in text && 'en' in text) {
    return isChineseLocale(locale) ? text.zh : text.en
  }
  return ''
}

export function formatTimeRange(
  timeFilter?: { startTs: number; endTs: number },
  locale?: string
): string | { start: string; end: string } {
  if (!timeFilter) return t('allTime', locale)
  const localeStr = isChineseLocale(locale) ? 'zh-CN' : 'en-US'
  return {
    start: new Date(timeFilter.startTs * 1000).toLocaleString(localeStr),
    end: new Date(timeFilter.endTs * 1000).toLocaleString(localeStr),
  }
}

export function formatMessageCompact(
  msg: {
    id?: number
    senderName: string
    content: string | null
    timestamp: number
  },
  locale?: string
): string {
  const localeStr = isChineseLocale(locale) ? 'zh-CN' : 'en-US'
  const time = new Date(msg.timestamp * 1000).toLocaleString(localeStr)
  let content = msg.content || t('noContent', locale)
  if (content.length > 200) {
    content = content.slice(0, 200) + '...'
  }
  return `${time} ${msg.senderName}: ${content}`
}
