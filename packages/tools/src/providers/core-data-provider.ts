/**
 * CoreDataProvider
 *
 * 基于 @openchatlab/core 同步查询函数的 ToolDataProvider 实现。
 * 供 Server / MCP 使用，通过 DatabaseAdapter 直接访问 SQLite。
 *
 * 新增的 Electron-first 方法（getChatOverview、searchSessions 等）暂未在 core 中实现，
 * 抛出 NotImplementedError。Server 的 TOOL_REGISTRY 不注册这些工具，不会实际调用到。
 */

import type { DatabaseAdapter } from '@openchatlab/core'
import {
  searchMessagesLike,
  getRecentMessages,
  getMemberActivity,
  getHourlyActivity,
  getWeekdayActivity,
  getDailyActivity,
  executeReadonlySql,
  getDatabaseSchema,
} from '@openchatlab/core'
import type {
  ToolDataProvider,
  SearchMessagesResult,
  MemberStatItem,
  SchemaTableInfo,
  TimeFilter,
  ChatOverviewResult,
  MemberInfo,
  NameHistoryItem,
  SessionSearchResult,
  SessionMessagesResult,
  ConversationResult,
  SessionSummaryItem,
  RawMessage,
} from '../types'

class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `CoreDataProvider.${method} is not implemented. This method is only available in Electron via WorkerDataProvider.`
    )
    this.name = 'NotImplementedError'
  }
}

export class CoreDataProvider implements ToolDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async searchMessages(
    keywords: string[],
    options?: { timeFilter?: TimeFilter; limit?: number; senderId?: number }
  ): Promise<SearchMessagesResult> {
    const keyword = keywords.join(' ')
    const result = searchMessagesLike(this.db, keyword, { limit: options?.limit ?? 50 })
    return {
      messages: result.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderPlatformId: m.senderPlatformId,
        content: m.content,
        timestamp: m.timestamp,
      })),
      total: result.total ?? result.messages.length,
    }
  }

  async deepSearchMessages(
    keywords: string[],
    options?: { timeFilter?: TimeFilter; limit?: number; senderId?: number }
  ): Promise<SearchMessagesResult> {
    return this.searchMessages(keywords, options)
  }

  async getSearchMessageContext(
    _messageIds: number[],
    _contextBefore: number,
    _contextAfter: number
  ): Promise<RawMessage[]> {
    throw new NotImplementedError('getSearchMessageContext')
  }

  async getRecentMessages(options?: { timeFilter?: TimeFilter; limit?: number }): Promise<SearchMessagesResult> {
    const messages = getRecentMessages(this.db, { limit: options?.limit ?? 50 })
    return {
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderPlatformId: m.senderPlatformId,
        content: m.content,
        timestamp: m.timestamp,
      })),
      total: messages.length,
    }
  }

  async getMessageContext(_messageIds: number[], _contextSize: number): Promise<RawMessage[]> {
    throw new NotImplementedError('getMessageContext')
  }

  async getChatOverview(_topN?: number): Promise<ChatOverviewResult | null> {
    throw new NotImplementedError('getChatOverview')
  }

  async getMembers(): Promise<MemberInfo[]> {
    throw new NotImplementedError('getMembers')
  }

  async getMemberStats(options?: { timeFilter?: TimeFilter; top?: number }): Promise<MemberStatItem[]> {
    const top = options?.top ?? 20
    const members = getMemberActivity(this.db, options?.timeFilter)
    return members.slice(0, top).map((m) => ({
      name: m.name,
      messageCount: m.messageCount,
      percentage: m.percentage,
    }))
  }

  async getMemberNameHistory(_memberId: number): Promise<NameHistoryItem[]> {
    throw new NotImplementedError('getMemberNameHistory')
  }

  async getTimeStats(type: 'hourly' | 'weekday' | 'daily', options?: { timeFilter?: TimeFilter }): Promise<unknown[]> {
    const filter = options?.timeFilter
    switch (type) {
      case 'weekday':
        return getWeekdayActivity(this.db, filter)
      case 'daily':
        return getDailyActivity(this.db, filter)
      case 'hourly':
      default:
        return getHourlyActivity(this.db, filter)
    }
  }

  async searchSessions(
    _keywords?: string[],
    _timeFilter?: TimeFilter,
    _limit?: number,
    _previewCount?: number
  ): Promise<SessionSearchResult[]> {
    throw new NotImplementedError('searchSessions')
  }

  async getSessionMessages(_chatSessionId: number, _limit?: number): Promise<SessionMessagesResult | null> {
    throw new NotImplementedError('getSessionMessages')
  }

  async getSessionSummaries(_options?: { limit?: number; timeFilter?: TimeFilter }): Promise<SessionSummaryItem[]> {
    throw new NotImplementedError('getSessionSummaries')
  }

  async getConversationBetween(
    _memberId1: number,
    _memberId2: number,
    _timeFilter?: TimeFilter,
    _limit?: number
  ): Promise<ConversationResult> {
    throw new NotImplementedError('getConversationBetween')
  }

  async executeSql(sql: string): Promise<unknown> {
    return executeReadonlySql(this.db, sql)
  }

  async executeParameterizedSql<T = Record<string, unknown>>(
    _query: string,
    _params: Record<string, unknown>
  ): Promise<T[]> {
    throw new NotImplementedError('executeParameterizedSql')
  }

  async getSchema(): Promise<SchemaTableInfo[]> {
    return getDatabaseSchema(this.db)
  }
}
