/**
 * 工具系统类型定义
 *
 * 平台无关的工具注册表类型，同时服务于 MCP Server、HTTP API 和 Electron Agent。
 */

import type { DatabaseAdapter } from '@openchatlab/core'

/**
 * JSON Schema 参数定义（兼容 MCP tool input schema）
 */
export interface JsonSchema {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description?: string
      items?: { type: string }
      default?: unknown
      enum?: unknown[]
      minimum?: number
      maximum?: number
    }
  >
  required?: string[]
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  db: DatabaseAdapter
  sessionId: string
  locale?: string
}

/**
 * 可预处理的原始消息（与 @openchatlab/node-runtime PreprocessableMessage 兼容）
 */
export interface RawMessage {
  id?: number
  senderId?: number
  senderName: string
  senderPlatformId?: string
  content: string | null
  timestamp: number
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  content: string
  data?: unknown
  /** 消息类工具可透传原始消息数据，供预处理管道消费 */
  rawMessages?: RawMessage[]
}

/**
 * 平台无关的工具定义
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: JsonSchema
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => ToolResult
}
