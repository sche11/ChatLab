/**
 * 技能 MD 文件解析器（平台无关，Node.js 实现）
 */

import * as path from 'path'
import matter from 'gray-matter'
import type { SkillDef } from './types'

export function parseSkillFile(content: string, filePath: string): SkillDef | null {
  try {
    const { data: fm, content: prompt } = matter(content)

    const id = fm.id ?? path.basename(filePath, '.md')
    const name = fm.name
    if (!name) return null

    return {
      id,
      name,
      description: fm.description ?? '',
      tags: parseTags(fm.tags),
      chatScope: validateChatScope(fm.chatScope),
      tools: Array.isArray(fm.tools) ? fm.tools : [],
      prompt: prompt.trim(),
    }
  } catch {
    return null
  }
}

export function extractSkillId(content: string, filePath: string): string | null {
  try {
    const { data: fm } = matter(content)
    return fm.id ?? path.basename(filePath, '.md')
  } catch {
    return null
  }
}

function parseTags(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  return []
}

function validateChatScope(raw: unknown): 'all' | 'group' | 'private' {
  if (raw === 'group' || raw === 'private') return raw
  return 'all'
}
