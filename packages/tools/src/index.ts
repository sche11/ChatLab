/**
 * @openchatlab/tools
 *
 * ChatLab AI 工具链。
 * 提供平台无关的工具定义和 handler，服务于 MCP Server、HTTP API 和 Electron Agent。
 */

export { TOOL_REGISTRY, getToolByName } from './registry'
export { CoreDataProvider } from './providers/core-data-provider'
export { memberStatsTool } from './definitions/member-stats'
export { timeStatsTool } from './definitions/time-stats'
export { searchTool } from './definitions/search'
export { recentMessagesTool } from './definitions/recent-messages'
export { sqlQueryTool, schemaTool } from './definitions/sql-query'
export type {
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
  JsonSchema,
  RawMessage,
  ToolDataProvider,
  SearchMessagesResult,
  MemberStatItem,
  SchemaTableInfo,
  TimeFilter,
  ToolCategory,
  TruncationStrategy,
} from './types'
