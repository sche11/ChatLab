/**
 * AI Web API — /_web/ai/ routes
 *
 * 提供助手、技能、LLM 配置和工具目录的只读 HTTP 接口，
 * 供 CLI serve Web 前端使用（对齐 Electron preload 的 window.*Api）。
 *
 * - 助手/技能数据来自 ~/.chatlab/ai/{assistants,skills}/*.md
 * - LLM 配置来自 ~/.chatlab/ai/llm-config.json
 * - 工具目录来自 @openchatlab/core 静态数据
 */

import * as fs from 'fs'
import * as path from 'path'
import type { FastifyInstance } from 'fastify'
import type { DatabaseManager } from '@openchatlab/node-runtime'
import { parseAssistantFile, parseSkillFile } from '@openchatlab/node-runtime'
import { BUILTIN_TOOL_CATALOG, BUILTIN_PROVIDERS, BUILTIN_MODELS, getBuiltinModelsByProvider } from '@openchatlab/core'
import type { AssistantSummary, SkillSummary } from '@openchatlab/node-runtime'

function getAiDir(dbManager: DatabaseManager): string {
  const pathProvider = (dbManager as any)['pathProvider']
  if (!pathProvider) {
    throw Object.assign(new Error('PathProvider not available'), { statusCode: 500 })
  }
  return pathProvider.getAiDataDir()
}

function scanMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f))
}

export function registerAiRoutes(server: FastifyInstance, dbManager: DatabaseManager): void {
  // ==================== Assistants ====================

  server.get('/_web/ai/assistants', async () => {
    const dir = path.join(getAiDir(dbManager), 'assistants')
    const files = scanMdFiles(dir)
    const results: AssistantSummary[] = []
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = parseAssistantFile(content, filePath)
        if (parsed) {
          results.push({
            id: parsed.id,
            name: parsed.name,
            systemPrompt: parsed.systemPrompt,
            presetQuestions: parsed.presetQuestions,
            builtinId: parsed.builtinId,
            applicableChatTypes: parsed.applicableChatTypes,
            supportedLocales: parsed.supportedLocales,
          })
        }
      } catch {
        // skip unparseable files
      }
    }
    return results
  })

  server.get<{ Params: { id: string } }>('/_web/ai/assistants/:id', async (request, reply) => {
    const { id } = request.params
    const dir = path.join(getAiDir(dbManager), 'assistants')
    const filePath = path.join(dir, `${id}.md`)

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = parseAssistantFile(content, filePath)
    if (!parsed) {
      return reply.code(404).send({ error: 'Parse failed' })
    }
    return parsed
  })

  // ==================== Skills ====================

  server.get('/_web/ai/skills', async () => {
    const dir = path.join(getAiDir(dbManager), 'skills')
    const files = scanMdFiles(dir)
    const results: SkillSummary[] = []
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = parseSkillFile(content, filePath)
        if (parsed) {
          results.push({
            id: parsed.id,
            name: parsed.name,
            description: parsed.description,
            tags: parsed.tags,
            chatScope: parsed.chatScope,
            tools: parsed.tools,
            builtinId: parsed.builtinId,
          })
        }
      } catch {
        // skip unparseable files
      }
    }
    return results
  })

  server.get<{ Params: { id: string } }>('/_web/ai/skills/:id', async (request, reply) => {
    const { id } = request.params
    const dir = path.join(getAiDir(dbManager), 'skills')
    const filePath = path.join(dir, `${id}.md`)

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = parseSkillFile(content, filePath)
    if (!parsed) {
      return reply.code(404).send({ error: 'Parse failed' })
    }
    return parsed
  })

  // ==================== LLM Config ====================

  server.get('/_web/ai/llm/has-config', async () => {
    const configPath = path.join(getAiDir(dbManager), 'llm-config.json')
    if (!fs.existsSync(configPath)) return false

    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      if (!data.configs || !Array.isArray(data.configs) || data.configs.length === 0) return false
      return data.defaultAssistant != null
    } catch {
      return false
    }
  })

  server.get('/_web/ai/llm/configs', async () => {
    const configPath = path.join(getAiDir(dbManager), 'llm-config.json')
    if (!fs.existsSync(configPath)) return { configs: [], defaultAssistant: null, fastModel: null }

    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const configs = (data.configs || []).map((c: Record<string, unknown>) => {
        const { apiKey: _k, ...rest } = c
        return { ...rest, apiKey: '' }
      })
      return {
        configs,
        defaultAssistant: data.defaultAssistant ?? null,
        fastModel: data.fastModel ?? null,
      }
    } catch {
      return { configs: [], defaultAssistant: null, fastModel: null }
    }
  })

  // ==================== Provider Registry & Model Catalog ====================

  server.get('/_web/ai/llm/providers', async () => {
    return BUILTIN_PROVIDERS.map((p) => {
      const models = getBuiltinModelsByProvider(p.id)
      return {
        id: p.id,
        name: p.name,
        defaultBaseUrl: p.defaultBaseUrl,
        models: models
          .filter((m) => !m.capabilities.includes('embedding') && !m.capabilities.includes('ranking'))
          .map((m) => ({ id: m.id, name: m.name, description: m.description })),
      }
    })
  })

  server.get('/_web/ai/llm/provider-registry', async () => {
    const customPath = path.join(getAiDir(dbManager), 'custom-providers.json')
    let custom: unknown[] = []
    if (fs.existsSync(customPath)) {
      try {
        custom = JSON.parse(fs.readFileSync(customPath, 'utf-8'))
        if (!Array.isArray(custom)) custom = []
      } catch {
        custom = []
      }
    }
    return [...BUILTIN_PROVIDERS, ...custom]
  })

  server.get('/_web/ai/llm/model-catalog', async () => {
    const customPath = path.join(getAiDir(dbManager), 'custom-models.json')
    let custom: unknown[] = []
    if (fs.existsSync(customPath)) {
      try {
        custom = JSON.parse(fs.readFileSync(customPath, 'utf-8'))
        if (!Array.isArray(custom)) custom = []
      } catch {
        custom = []
      }
    }
    return [...BUILTIN_MODELS, ...custom]
  })

  server.get('/_web/ai/llm/default-assistant-slot', async () => {
    const configPath = path.join(getAiDir(dbManager), 'llm-config.json')
    if (!fs.existsSync(configPath)) return null
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return data.defaultAssistant ?? null
    } catch {
      return null
    }
  })

  server.get('/_web/ai/llm/fast-model-slot', async () => {
    const configPath = path.join(getAiDir(dbManager), 'llm-config.json')
    if (!fs.existsSync(configPath)) return null
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return data.fastModel ?? null
    } catch {
      return null
    }
  })

  // ==================== Tool Catalog ====================

  server.get('/_web/ai/tools/catalog', async () => {
    return BUILTIN_TOOL_CATALOG
  })
}
