/**
 * 工具定义聚合 + 统一注册表
 *
 * TOOL_REGISTRY 是全局唯一的工具清单，驱动后端加载和前端目录展示。
 * 所有工具定义来自 @openchatlab/tools 共享包，通过 adaptSharedTool 适配为 Electron AgentTool。
 */

import type { ToolRegistryEntry } from '../types'

import {
  chatOverviewTool,
  searchMessagesTool,
  deepSearchMessagesTool,
  recentMessagesTool,
  getMessageContextTool,
  searchSessionsTool,
  getSessionMessagesTool,
  getMembersTool,
  memberStatsTool,
  timeStatsTool,
  getMemberNameHistoryTool,
  getConversationBetweenTool,
  getSessionSummariesTool,
  responseTimeAnalysisTool,
  keywordFrequencyTool,
  SQL_TOOL_DEFS,
  createSqlToolDefinition,
} from '@openchatlab/tools'

import { adaptSharedTool } from '../shared-tool-adapter'

// SQL 工具转换为 ToolDefinition 再适配
const sqlToolDefinitions = SQL_TOOL_DEFS.map(createSqlToolDefinition)

export const sqlToolEntries: ToolRegistryEntry[] = sqlToolDefinitions.map((t) =>
  adaptSharedTool(t, { electronName: t.name, category: 'analysis' })
)

export const SQL_TOOL_NAMES = SQL_TOOL_DEFS.map((d) => d.name)

export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  // ==================== Core 工具（始终加载） ====================
  adaptSharedTool(chatOverviewTool, { electronName: 'get_chat_overview', category: 'core' }),
  adaptSharedTool(searchMessagesTool, {
    electronName: 'search_messages',
    category: 'core',
    truncationStrategy: 'keep_first',
  }),
  adaptSharedTool(deepSearchMessagesTool, {
    electronName: 'deep_search_messages',
    category: 'core',
    truncationStrategy: 'keep_first',
  }),
  adaptSharedTool(recentMessagesTool, {
    electronName: 'get_recent_messages',
    category: 'core',
    truncationStrategy: 'keep_last',
  }),
  adaptSharedTool(getMessageContextTool, {
    electronName: 'get_message_context',
    category: 'core',
    truncationStrategy: 'keep_last',
  }),
  adaptSharedTool(searchSessionsTool, { electronName: 'search_sessions', category: 'core' }),
  adaptSharedTool(getSessionMessagesTool, {
    electronName: 'get_session_messages',
    category: 'core',
    truncationStrategy: 'keep_last',
  }),
  adaptSharedTool(getMembersTool, { electronName: 'get_members', category: 'core' }),

  // ==================== Analysis 工具（按需加载） ====================
  adaptSharedTool(memberStatsTool, { electronName: 'get_member_stats', category: 'analysis' }),
  adaptSharedTool(timeStatsTool, { electronName: 'get_time_stats', category: 'analysis' }),
  adaptSharedTool(getMemberNameHistoryTool, { electronName: 'get_member_name_history', category: 'analysis' }),
  adaptSharedTool(getConversationBetweenTool, {
    electronName: 'get_conversation_between',
    category: 'analysis',
    truncationStrategy: 'keep_last',
  }),
  adaptSharedTool(getSessionSummariesTool, { electronName: 'get_session_summaries', category: 'analysis' }),
  adaptSharedTool(responseTimeAnalysisTool, { electronName: 'response_time_analysis', category: 'analysis' }),
  adaptSharedTool(keywordFrequencyTool, { electronName: 'keyword_frequency', category: 'analysis' }),

  // ==================== SQL 分析工具 ====================
  ...sqlToolEntries,
]
