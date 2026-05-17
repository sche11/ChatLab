/**
 * 基础查询模块
 * 查询逻辑委托给 @openchatlab/core，本模块负责数据库连接管理和成员 DDL 迁移
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import { closeDatabase, getDbPath, getCacheDir, openDatabaseAdapter, type TimeFilter } from '../core'
import { getCache, CACHE_KEY_OVERVIEW, type OverviewCache } from '../../database/sessionCache'
import {
  getAvailableYears as coreGetAvailableYears,
  getMemberActivity as coreGetMemberActivity,
  getHourlyActivity as coreGetHourlyActivity,
  getDailyActivity as coreGetDailyActivity,
  getWeekdayActivity as coreGetWeekdayActivity,
  getMonthlyActivity as coreGetMonthlyActivity,
  getYearlyActivity as coreGetYearlyActivity,
  getMessageTypeStats as coreGetMessageTypeStats,
  getMessageLengthDistribution as coreGetMessageLengthDistribution,
  getTimeRange as coreGetTimeRange,
  getMemberNameHistory as coreGetMemberNameHistory,
  getMembersWithAliases as coreGetMembersWithAliases,
  getMembersPaginated as coreGetMembersPaginated,
} from '@openchatlab/core'
import type { MembersPaginationParams, MembersPaginatedResult, MemberWithAliases } from '@openchatlab/core'

// ==================== 基础查询（委托给 core） ====================

export function getAvailableYears(sessionId: string): number[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetAvailableYears(db)
}

export function getMemberActivity(sessionId: string, filter?: TimeFilter): any[] {
  ensureAvatarColumn(sessionId)
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetMemberActivity(db, filter)
}

export function getHourlyActivity(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetHourlyActivity(db, filter)
}

export function getDailyActivity(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetDailyActivity(db, filter)
}

export function getWeekdayActivity(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetWeekdayActivity(db, filter)
}

export function getMonthlyActivity(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetMonthlyActivity(db, filter)
}

export function getYearlyActivity(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetYearlyActivity(db, filter)
}

export function getMessageTypeDistribution(sessionId: string, filter?: TimeFilter): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetMessageTypeStats(db, filter)
}

export function getMessageLengthDistribution(
  sessionId: string,
  filter?: TimeFilter
): {
  detail: Array<{ len: number; count: number }>
  grouped: Array<{ range: string; count: number }>
} {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return { detail: [], grouped: [] }
  return coreGetMessageLengthDistribution(db, filter)
}

export function getTimeRange(sessionId: string): { start: number; end: number } | null {
  const overview = getCache<OverviewCache>(sessionId, CACHE_KEY_OVERVIEW, getCacheDir())
  if (overview?.firstMessageTs != null && overview?.lastMessageTs != null) {
    return { start: overview.firstMessageTs, end: overview.lastMessageTs }
  }
  const db = openDatabaseAdapter(sessionId)
  if (!db) return null
  return coreGetTimeRange(db)
}

/**
 * 获取成员的历史昵称记录 (delegates to core)
 */
export function getMemberNameHistory(sessionId: string, memberId: number): any[] {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetMemberNameHistory(db, memberId)
}

// ==================== 成员管理 ====================

// 用于标记已检查过 aliases 字段的会话
const aliasesCheckedSessions = new Set<string>()
// 用于标记已检查过 avatar 字段的会话
const avatarCheckedSessions = new Set<string>()

/**
 * 确保 member 表有 aliases 字段（数据库迁移）
 * 用于兼容旧数据库
 */
function ensureAliasesColumn(sessionId: string): void {
  // 每个会话只检查一次
  if (aliasesCheckedSessions.has(sessionId)) return

  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath)) return

  // 先关闭可能缓存的只读连接
  closeDatabase(sessionId)

  // 使用写入模式打开数据库检查并添加字段
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  try {
    // 检查 aliases 字段是否存在
    const columns = db.prepare('PRAGMA table_info(member)').all() as Array<{ name: string }>
    const hasAliases = columns.some((col) => col.name === 'aliases')

    if (!hasAliases) {
      // 添加 aliases 字段
      db.exec("ALTER TABLE member ADD COLUMN aliases TEXT DEFAULT '[]'")
      console.log(`[Worker] Added aliases column to member table in session ${sessionId}`)
    }

    // 标记为已检查
    aliasesCheckedSessions.add(sessionId)
  } finally {
    db.close()
  }
}

/**
 * 确保 member 表有 avatar 字段（数据库迁移）
 * 用于兼容旧数据库
 */
export function ensureAvatarColumn(sessionId: string): void {
  // 每个会话只检查一次
  if (avatarCheckedSessions.has(sessionId)) return

  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath)) return

  // 先关闭可能缓存的只读连接
  closeDatabase(sessionId)

  // 使用写入模式打开数据库检查并添加字段
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  try {
    // 检查 avatar 字段是否存在
    const columns = db.prepare('PRAGMA table_info(member)').all() as Array<{ name: string }>
    const hasAvatar = columns.some((col) => col.name === 'avatar')

    if (!hasAvatar) {
      // 添加 avatar 字段
      db.exec('ALTER TABLE member ADD COLUMN avatar TEXT')
      console.log(`[Worker] Added avatar column to member table in session ${sessionId}`)
    }

    // 标记为已检查
    avatarCheckedSessions.add(sessionId)
  } finally {
    db.close()
  }
}

/**
 * 获取所有成员列表（含消息数、别名和头像）
 * Delegates to core getMembersWithAliases after ensuring schema columns exist.
 */
export function getMembers(sessionId: string): MemberWithAliases[] {
  ensureAliasesColumn(sessionId)
  ensureAvatarColumn(sessionId)

  const db = openDatabaseAdapter(sessionId)
  if (!db) return []
  return coreGetMembersWithAliases(db)
}

export type { MembersPaginationParams, MembersPaginatedResult }

/**
 * 获取成员列表（分页版本，支持搜索和排序）
 * Delegates to core getMembersPaginated after ensuring schema columns exist.
 */
export function getMembersPaginated(sessionId: string, params: MembersPaginationParams): MembersPaginatedResult {
  ensureAliasesColumn(sessionId)
  ensureAvatarColumn(sessionId)

  const db = openDatabaseAdapter(sessionId)
  if (!db) {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    return { members: [], total: 0, page, pageSize, totalPages: 0 }
  }
  return coreGetMembersPaginated(db, params)
}

/**
 * 更新成员别名
 */
export function updateMemberAliases(sessionId: string, memberId: number, aliases: string[]): boolean {
  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath)) {
    return false
  }

  try {
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    const stmt = db.prepare('UPDATE member SET aliases = ? WHERE id = ?')
    stmt.run(JSON.stringify(aliases), memberId)

    db.close()
    return true
  } catch (error) {
    console.error('[Worker] Failed to update member aliases:', error)
    return false
  }
}

type MemberMergeRow = {
  id: number
  platformId: string
  accountName: string | null
  groupNickname: string | null
  aliases: string | null
  avatar: string | null
  messageCount: number
}

function parseAliases(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

/**
 * 合并两个成员（保留消息数更多的一方）
 */
export function mergeMembers(sessionId: string, memberId1: number, memberId2: number): boolean {
  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath) || memberId1 === memberId2) {
    return false
  }

  try {
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    const rows = db
      .prepare(
        `
        SELECT
          m.id,
          m.platform_id as platformId,
          m.account_name as accountName,
          m.group_nickname as groupNickname,
          m.aliases,
          m.avatar,
          COUNT(msg.id) as messageCount
        FROM member m
        LEFT JOIN message msg ON m.id = msg.sender_id
        WHERE m.id IN (?, ?)
        GROUP BY m.id
      `
      )
      .all(memberId1, memberId2) as MemberMergeRow[]

    if (rows.length !== 2) {
      db.close()
      return false
    }

    const [memberA, memberB] = rows
    let primary = memberA
    let secondary = memberB

    if (
      memberB.messageCount > memberA.messageCount ||
      (memberB.messageCount === memberA.messageCount && memberB.id < memberA.id)
    ) {
      primary = memberB
      secondary = memberA
    }

    const mergedAliases = Array.from(new Set([...parseAliases(primary.aliases), ...parseAliases(secondary.aliases)]))
    const mergedAccountName = primary.accountName || secondary.accountName
    const mergedGroupNickname = primary.groupNickname || secondary.groupNickname
    const mergedAvatar = primary.avatar || secondary.avatar

    const mergeTransaction = db.transaction(() => {
      // 1. 归并消息归属到主成员
      db.prepare('UPDATE message SET sender_id = ? WHERE sender_id = ?').run(primary.id, secondary.id)

      // 2. 归并昵称历史
      db.prepare('UPDATE member_name_history SET member_id = ? WHERE member_id = ?').run(primary.id, secondary.id)

      // 3. owner_id 若指向被合并成员，切换到主成员 platformId
      db.prepare('UPDATE meta SET owner_id = ? WHERE owner_id = ?').run(primary.platformId, secondary.platformId)

      // 4. 更新主成员资料（默认以消息更多一方为主，补齐缺失字段）
      db.prepare(
        `
          UPDATE member
          SET account_name = ?, group_nickname = ?, avatar = ?, aliases = ?
          WHERE id = ?
        `
      ).run(mergedAccountName, mergedGroupNickname, mergedAvatar, JSON.stringify(mergedAliases), primary.id)

      // 5. 删除被合并成员
      db.prepare('DELETE FROM member WHERE id = ?').run(secondary.id)
    })

    mergeTransaction()
    db.close()
    return true
  } catch (error) {
    console.error('[Worker] Failed to merge members:', error)
    return false
  }
}

/**
 * 删除成员及其所有消息
 */
export function deleteMember(sessionId: string, memberId: number): boolean {
  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath)) {
    return false
  }

  try {
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    // 使用事务删除成员及其相关数据
    const deleteTransaction = db.transaction(() => {
      // 1. 删除该成员的消息
      db.prepare('DELETE FROM message WHERE sender_id = ?').run(memberId)

      // 2. 删除该成员的昵称历史
      db.prepare('DELETE FROM member_name_history WHERE member_id = ?').run(memberId)

      // 3. 删除成员记录
      db.prepare('DELETE FROM member WHERE id = ?').run(memberId)
    })

    deleteTransaction()
    db.close()
    return true
  } catch (error) {
    console.error('[Worker] Failed to delete member:', error)
    return false
  }
}
