/**
 * Chat record merger module — Electron adapter layer.
 * Delegates pure algorithms to @openchatlab/core and orchestration to @openchatlab/node-runtime.
 * Keeps only platform-specific I/O: file parsing, temp DB access, session DB export, importData.
 */

import * as fs from 'fs'
import * as path from 'path'
import { generateMessageKey, getCollidingPlatformIds, normalizePlatformId } from '@openchatlab/core'
import type { MergerMember, MergerMessage } from '@openchatlab/core'
import { checkConflictsFromSources, buildMergedOutput, serializeChatLabToJsonl } from '@openchatlab/node-runtime'
import type { MergerDataSource, MergerSourceMeta, ChatLabOutput } from '@openchatlab/node-runtime'
import { parseFileSync, detectFormat } from '../parser'
import { importData } from '../database/core'
import { TempDbReader } from './tempCache'
import { getDownloadsDir } from '../paths'
import type { ParseResult, ChatPlatform, ChatType } from '../../../src/types/base'
import type {
  ChatLabFormat,
  ChatLabMember,
  ChatLabMessage,
  FileParseInfo,
  ConflictCheckResult,
  MergeParams,
  MergeResult,
  MergeSource,
} from '../../../src/types/format'

function getDefaultOutputDir(): string {
  return getDownloadsDir()
}

function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function generateOutputFilename(name: string, format: 'json' | 'jsonl' = 'json'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safeName = name.replace(/[/\\?%*:|"<>]/g, '_')
  return `${safeName}_merged_${date}.${format}`
}

/**
 * Parse a file to get basic info (for preview).
 * Prefer parser.parseFileInfo for more detailed info.
 */
export async function parseFileInfo(filePath: string): Promise<FileParseInfo> {
  const format = detectFormat(filePath)
  if (!format) {
    throw new Error('Cannot detect file format')
  }

  const result = await parseFileSync(filePath)

  return {
    name: result.meta.name,
    format: format.name,
    platform: result.meta.platform,
    messageCount: result.messages.length,
    memberCount: result.members.length,
  }
}

// ==================== ChatLabOutput → ChatLabFormat conversion ====================

function chatLabOutputToFormat(data: ChatLabOutput): ChatLabFormat {
  return {
    chatlab: data.chatlab,
    meta: {
      ...data.meta,
      platform: data.meta.platform as ChatPlatform,
      type: data.meta.type as ChatType,
    },
    members: data.members.map((m) => ({
      platformId: m.platformId,
      accountName: m.accountName || m.platformId,
      groupNickname: m.groupNickname,
      avatar: m.avatar,
    })),
    messages: data.messages.map((msg) => ({
      sender: msg.sender,
      accountName: msg.accountName || msg.sender,
      groupNickname: msg.groupNickname,
      timestamp: msg.timestamp,
      type: msg.type,
      content: msg.content ?? null,
    })),
  }
}

// ==================== TempDbReader → MergerDataSource adapter ====================

function wrapTempDbReader(reader: TempDbReader): MergerDataSource {
  return {
    getMeta(): MergerSourceMeta | null {
      const meta = reader.getMeta()
      if (!meta) return null
      return {
        name: meta.name,
        platform: meta.platform,
        type: meta.type,
        groupId: meta.groupId,
        groupAvatar: meta.groupAvatar,
      }
    },
    getMembers(): MergerMember[] {
      return reader.getMembers().map((m) => ({
        platformId: m.platformId,
        accountName: m.accountName,
        groupNickname: m.groupNickname,
        avatar: m.avatar,
      }))
    },
    getMessageCount(): number {
      return reader.getMessageCount()
    },
    streamMessages(batchSize: number, callback: (messages: MergerMessage[]) => void): void {
      reader.streamMessages(batchSize, (messages) => {
        callback(
          messages.map((msg) => ({
            senderPlatformId: msg.senderPlatformId,
            senderAccountName: msg.senderAccountName,
            senderGroupNickname: msg.senderGroupNickname,
            timestamp: msg.timestamp,
            type: msg.type,
            content: msg.content,
          }))
        )
      })
    },
  }
}

// ==================== Merge with cache (legacy, non-TempDB path) ====================

export async function mergeFilesWithCache(params: MergeParams, cache: Map<string, ParseResult>): Promise<MergeResult> {
  try {
    const { filePaths, outputName, outputDir, conflictResolutions: _conflictResolutions, andAnalyze } = params

    console.log('[Merger] mergeFilesWithCache: Starting merge')

    const parseResults: Array<{ result: ParseResult; source: string }> = []
    for (const filePath of filePaths) {
      let result: ParseResult
      if (cache.has(filePath)) {
        result = cache.get(filePath)!
        console.log(`[Merger] Cache hit: ${path.basename(filePath)}`)
      } else {
        console.log(`[Merger] Cache miss, re-parsing: ${path.basename(filePath)}`)
        result = await parseFileSync(filePath)
      }
      parseResults.push({ result, source: path.basename(filePath) })
    }

    return executeMergeLegacy(parseResults, outputName, outputDir, andAnalyze)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Merge failed',
    }
  }
}

function executeMergeLegacy(
  parseResults: Array<{ result: ParseResult; source: string }>,
  outputName: string,
  outputDir: string | undefined,
  andAnalyze: boolean
): MergeResult {
  const collidingIds = getCollidingPlatformIds(
    parseResults.map(({ result }) => ({
      platform: result.meta.platform || 'unknown',
      members: result.members.map((m) => ({ platformId: m.platformId })),
    }))
  )

  const memberMap = new Map<string, ChatLabMember>()
  for (const { result } of parseResults) {
    const sourcePlatform = result.meta.platform || 'unknown'
    for (const member of result.members) {
      const nid = normalizePlatformId(member.platformId, sourcePlatform, collidingIds)
      const existing = memberMap.get(nid)
      if (existing) {
        if (member.accountName) existing.accountName = member.accountName
        if (member.groupNickname) existing.groupNickname = member.groupNickname
        if (member.avatar) existing.avatar = member.avatar
      } else {
        memberMap.set(nid, {
          platformId: nid,
          accountName: member.accountName,
          groupNickname: member.groupNickname,
          avatar: member.avatar,
        })
      }
    }
  }

  const seenKeys = new Set<string>()
  const mergedMessages: ChatLabMessage[] = []
  for (const { result } of parseResults) {
    const sourcePlatform = result.meta.platform || 'unknown'
    for (const msg of result.messages) {
      const nid = normalizePlatformId(msg.senderPlatformId, sourcePlatform, collidingIds)
      const key = generateMessageKey(msg.timestamp, nid, msg.content ?? null)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      mergedMessages.push({
        sender: nid,
        accountName: msg.senderAccountName,
        groupNickname: msg.senderGroupNickname,
        timestamp: msg.timestamp,
        type: msg.type,
        content: msg.content,
      })
    }
  }

  mergedMessages.sort((a, b) => a.timestamp - b.timestamp)

  const sources: MergeSource[] = parseResults.map(({ result, source }) => ({
    filename: source,
    platform: result.meta.platform,
    messageCount: result.messages.length,
  }))

  const groupIds = new Set(parseResults.map(({ result }) => result.meta.groupId).filter(Boolean))
  const groupId =
    groupIds.size === 1 ? parseResults.find(({ result }) => result.meta.groupId)?.result.meta.groupId : undefined
  const groupAvatar = groupId
    ? parseResults.filter(({ result }) => result.meta.groupId === groupId).pop()?.result.meta.groupAvatar
    : undefined

  const chatLabHeader = {
    version: '0.0.1',
    exportedAt: Math.floor(Date.now() / 1000),
    generator: 'ChatLab Merge Tool',
    description: `Merged from ${parseResults.length} files`,
  }

  const uniquePlatforms = [...new Set(parseResults.map(({ result }) => result.meta.platform || 'unknown'))]
  const mergedPlatform = uniquePlatforms.length === 1 ? uniquePlatforms[0] : 'mixed'

  const chatLabMeta = {
    name: outputName,
    platform: mergedPlatform as ChatPlatform,
    type: parseResults[0].result.meta.type as ChatType,
    sources,
    groupId,
    groupAvatar,
  }

  const targetDir = outputDir || getDefaultOutputDir()
  ensureOutputDir(targetDir)
  const outputPath = path.join(targetDir, generateOutputFilename(outputName, 'json'))

  const chatLabData: ChatLabFormat = {
    chatlab: chatLabHeader,
    meta: chatLabMeta,
    members: Array.from(memberMap.values()),
    messages: mergedMessages,
  }
  fs.writeFileSync(outputPath, JSON.stringify(chatLabData, null, 2), 'utf-8')

  let sessionId: string | undefined
  if (andAnalyze) {
    sessionId = importData({
      meta: {
        name: chatLabMeta.name,
        platform: chatLabMeta.platform,
        type: chatLabMeta.type,
        groupId: chatLabMeta.groupId,
        groupAvatar: chatLabMeta.groupAvatar,
      },
      members: chatLabData.members.map((member) => ({
        platformId: member.platformId,
        accountName: member.accountName,
        groupNickname: member.groupNickname,
        avatar: member.avatar,
      })),
      messages: chatLabData.messages.map((msg) => ({
        senderPlatformId: msg.sender,
        senderAccountName: msg.accountName,
        senderGroupNickname: msg.groupNickname,
        timestamp: msg.timestamp,
        type: msg.type,
        content: msg.content,
      })),
    })
  }

  return { success: true, outputPath, sessionId }
}

// ==================== TempDB-based merge (delegates to node-runtime) ====================

export async function checkConflictsWithTempDb(
  filePaths: string[],
  tempDbCache: Map<string, string>
): Promise<ConflictCheckResult> {
  const readers: TempDbReader[] = []
  try {
    const dataSources: Array<{ source: MergerDataSource; filename: string }> = []
    for (const filePath of filePaths) {
      const tempDbPath = tempDbCache.get(filePath)
      if (!tempDbPath) {
        throw new Error(`Temp database not found: ${path.basename(filePath)}`)
      }
      const reader = new TempDbReader(tempDbPath)
      readers.push(reader)
      dataSources.push({ source: wrapTempDbReader(reader), filename: path.basename(filePath) })
    }

    return checkConflictsFromSources(dataSources)
  } finally {
    for (const reader of readers) {
      reader.close()
    }
  }
}

export async function mergeFilesWithTempDb(
  params: MergeParams,
  tempDbCache: Map<string, string>
): Promise<MergeResult> {
  const { filePaths, outputName, outputDir, outputFormat = 'json', andAnalyze } = params

  console.log('[Merger] mergeFilesWithTempDb: Starting merge')

  const readers: TempDbReader[] = []
  try {
    const dataSources: Array<{ source: MergerDataSource; filename: string }> = []
    for (const filePath of filePaths) {
      const tempDbPath = tempDbCache.get(filePath)
      if (!tempDbPath) {
        throw new Error(`Temp database not found: ${path.basename(filePath)}`)
      }
      const reader = new TempDbReader(tempDbPath)
      readers.push(reader)
      dataSources.push({ source: wrapTempDbReader(reader), filename: path.basename(filePath) })
    }

    const result = buildMergedOutput(dataSources, outputName)
    const chatLabData = result.chatLabData

    // Write to disk
    const targetDir = outputDir || getDefaultOutputDir()
    ensureOutputDir(targetDir)
    const filename = generateOutputFilename(outputName, outputFormat)
    const outputPath = path.join(targetDir, filename)

    if (outputFormat === 'jsonl') {
      const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' })
      for (const line of serializeChatLabToJsonl(chatLabData)) {
        writeStream.write(line + '\n')
      }
      writeStream.end()
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })
    } else {
      const fileData: ChatLabFormat = chatLabOutputToFormat(chatLabData)
      fs.writeFileSync(outputPath, JSON.stringify(fileData, null, 2), 'utf-8')
    }

    console.log(`[Merger] Messages after merge: ${chatLabData.messages.length}`)

    let sessionId: string | undefined
    if (andAnalyze) {
      const fmt = chatLabOutputToFormat(chatLabData)
      sessionId = importData({
        meta: {
          name: fmt.meta.name,
          platform: fmt.meta.platform,
          type: fmt.meta.type,
          groupId: fmt.meta.groupId,
          groupAvatar: fmt.meta.groupAvatar,
        },
        members: fmt.members.map((m) => ({
          platformId: m.platformId,
          accountName: m.accountName,
          groupNickname: m.groupNickname,
          avatar: m.avatar,
        })),
        messages: fmt.messages.map((msg) => ({
          senderPlatformId: msg.sender,
          senderAccountName: msg.accountName,
          senderGroupNickname: msg.groupNickname,
          timestamp: msg.timestamp,
          type: msg.type,
          content: msg.content,
        })),
      })
    }

    return { success: true, outputPath, sessionId }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Merge failed',
    }
  } finally {
    for (const reader of readers) {
      reader.close()
    }
  }
}

// ==================== Session DB export ====================

import Database from 'better-sqlite3'
import { getDbPath } from '../database/core'

export async function exportSessionToTempFile(sessionId: string): Promise<string> {
  const dbPath = getDbPath(sessionId)
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Session database not found: ${sessionId}`)
  }

  const db = new Database(dbPath, { readonly: true })

  try {
    const meta = db.prepare('SELECT * FROM meta').get() as {
      name: string
      platform: string
      type: string
      group_id?: string
      group_avatar?: string
    }

    if (!meta) {
      throw new Error('Cannot read session meta')
    }

    const members = db.prepare('SELECT platform_id, account_name, group_nickname, avatar FROM member').all() as Array<{
      platform_id: string
      account_name?: string
      group_nickname?: string
      avatar?: string
    }>

    const messages = db
      .prepare(
        `SELECT 
          m.platform_id as sender,
          msg.sender_account_name as accountName,
          msg.sender_group_nickname as groupNickname,
          msg.ts as timestamp,
          msg.type,
          msg.content
        FROM message msg
        JOIN member m ON msg.sender_id = m.id
        ORDER BY msg.ts`
      )
      .all() as Array<{
      sender: string
      accountName?: string
      groupNickname?: string
      timestamp: number
      type: number
      content?: string
    }>

    const chatLabData: ChatLabFormat = {
      chatlab: {
        version: '0.0.1',
        exportedAt: Math.floor(Date.now() / 1000),
        generator: 'ChatLab Export',
        description: `Exported from session: ${meta.name}`,
      },
      meta: {
        name: meta.name,
        platform: meta.platform as ChatPlatform,
        type: meta.type as ChatType,
        groupId: meta.group_id,
        groupAvatar: meta.group_avatar,
      },
      members: members.map((m) => ({
        platformId: m.platform_id,
        accountName: m.account_name || m.platform_id,
        groupNickname: m.group_nickname || undefined,
        avatar: m.avatar,
      })),
      messages: messages.map((msg) => ({
        sender: msg.sender,
        accountName: msg.accountName || msg.sender,
        groupNickname: msg.groupNickname || undefined,
        timestamp: msg.timestamp,
        type: msg.type as ChatLabMessage['type'],
        content: msg.content ?? null,
      })),
    }

    const tempDir = path.join(getDefaultOutputDir(), '.chatlab_temp')
    ensureOutputDir(tempDir)
    const tempFilePath = path.join(tempDir, `export_${sessionId}_${Date.now()}.json`)
    fs.writeFileSync(tempFilePath, JSON.stringify(chatLabData, null, 2), 'utf-8')

    console.log(`[Merger] Exporting session to temp file: ${tempFilePath}, message count: ${messages.length}`)

    return tempFilePath
  } finally {
    db.close()
  }
}

export function cleanupTempExportFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`[Merger] Cleaning up temp file: ${filePath}`)
      }
    } catch (err) {
      console.error(`[Merger] Failed to clean up temp file: ${filePath}`, err)
    }
  }
}
