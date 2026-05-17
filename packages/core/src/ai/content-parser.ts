/**
 * Agent content parsing utilities.
 * Extracts thinking tags and strips tool-call markup from LLM output.
 */

const THINK_TAGS = ['think', 'analysis', 'reasoning', 'reflection', 'thought', 'thinking']

export function extractThinkingContent(content: string): { thinking: string; cleanContent: string } {
  if (!content) {
    return { thinking: '', cleanContent: '' }
  }

  const tagPattern = THINK_TAGS.join('|')
  const thinkRegex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)<\\/\\1>`, 'gi')
  const thinkingParts: string[] = []
  let cleanContent = content

  const matches = content.matchAll(thinkRegex)
  for (const match of matches) {
    const thinkText = match[2].trim()
    if (thinkText) {
      thinkingParts.push(thinkText)
    }
    cleanContent = cleanContent.replace(match[0], '')
  }

  return { thinking: thinkingParts.join('\n').trim(), cleanContent: cleanContent.trim() }
}

export function stripToolCallTags(content: string): string {
  return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()
}
