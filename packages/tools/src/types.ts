/**
 * 工具系统类型定义
 *
 * 平台无关的工具注册表类型，同时服务于 MCP Server、HTTP API 和 Electron Agent。
 */

import type { DatabaseAdapter } from '@openchatlab/core'

// ==================== Schema ====================

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

// ==================== Time Filter ====================

export interface TimeFilter {
  startTs: number
  endTs: number
}

// ==================== Data Provider ====================

export interface SearchMessagesResult {
  messages: RawMessage[]
  total: number
}

export interface MemberStatItem {
  name: string
  messageCount: number
  percentage: number
}

export interface SchemaTableInfo {
  name: string
  sql: string
}

/**
 * 工具数据查询抽象接口
 *
 * Server 和 Electron 各自实现：
 * - CoreDataProvider: 通过 @openchatlab/core 查询函数 + DatabaseAdapter
 * - WorkerDataProvider: 通过 workerManager IPC 调用 Worker 线程
 */
export interface ToolDataProvider {
  searchMessages(
    keywords: string[],
    options?: { timeFilter?: TimeFilter; limit?: number; senderId?: number }
  ): Promise<SearchMessagesResult>

  getRecentMessages(options?: { timeFilter?: TimeFilter; limit?: number }): Promise<SearchMessagesResult>

  getMemberStats(options?: { timeFilter?: TimeFilter; top?: number }): Promise<MemberStatItem[]>

  getTimeStats(type: 'hourly' | 'weekday' | 'daily', options?: { timeFilter?: TimeFilter }): Promise<unknown[]>

  executeSql(sql: string): Promise<unknown>

  getSchema(): Promise<SchemaTableInfo[]>
}

// ==================== Tool Context ====================

/**
 * 工具执行上下文
 *
 * 过渡期：db 保持 required 以兼容现有工具，dataProvider 为 optional。
 * 迁移完成后 db 降为 optional / 移除。
 */
export interface ToolExecutionContext {
  sessionId: string
  locale?: string
  timeFilter?: TimeFilter
  /** 抽象查询接口，迁移后的工具使用此字段获取数据 */
  dataProvider?: ToolDataProvider
  /** @deprecated 逐步迁移到 dataProvider 后移除；Electron 端不提供此字段 */
  db?: DatabaseAdapter
}

// ==================== Raw Message ====================

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

// ==================== Tool Result ====================

/**
 * 工具执行结果
 */
export interface ToolResult {
  content: string
  data?: unknown
  /** 消息类工具可透传原始消息数据，供预处理管道消费 */
  rawMessages?: RawMessage[]
}

// ==================== Tool Definition ====================

export type ToolCategory = 'core' | 'analysis'
export type TruncationStrategy = 'keep_first' | 'keep_last'

/**
 * 平台无关的工具定义
 *
 * handler 支持同步和异步返回，兼容 Server（同步 DB）和 Electron（异步 Worker）。
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: JsonSchema
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => ToolResult | Promise<ToolResult>
  category?: ToolCategory
  truncationStrategy?: TruncationStrategy
}
