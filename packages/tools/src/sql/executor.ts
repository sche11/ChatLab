/**
 * 声明式 SQL 工具执行器
 *
 * 将 SqlToolDef 转换为 ToolDefinition，通过 dataProvider.executeParameterizedSql 执行。
 */

import type { ToolDefinition, ToolExecutionContext, ToolResult, SqlToolDef } from '../types'

function formatRow(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, col) => {
    const val = row[col]
    return val !== null && val !== undefined ? String(val) : ''
  })
}

function resolveTemplate(
  toolName: string,
  key: string,
  fallback: string,
  translateFn?: (key: string) => string | undefined
): string {
  if (!translateFn) return fallback
  const i18nKey = `ai.tools.${toolName}.${key}`
  return translateFn(i18nKey) ?? fallback
}

export function createSqlToolDefinition(def: SqlToolDef): ToolDefinition {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.parameters,
    category: 'analysis',
    handler: async (params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> => {
      const rows = await context.dataProvider!.executeParameterizedSql(def.execution.query, params)

      const fallback = resolveTemplate(def.name, 'fallback', def.execution.fallback, context.translateTemplate)

      if (!rows || rows.length === 0) {
        return {
          content: fallback,
          data: { rows: [], rowCount: 0 },
        }
      }

      const rowTemplate = resolveTemplate(def.name, 'rowTemplate', def.execution.rowTemplate, context.translateTemplate)
      const summaryTemplate = def.execution.summaryTemplate
        ? resolveTemplate(def.name, 'summaryTemplate', def.execution.summaryTemplate, context.translateTemplate)
        : undefined

      const lines: string[] = []

      if (summaryTemplate) {
        lines.push(summaryTemplate.replace(/\{rowCount\}/g, String(rows.length)))
        lines.push('')
      }

      for (const row of rows) {
        lines.push(formatRow(rowTemplate, row as Record<string, unknown>))
      }

      return {
        content: lines.join('\n'),
        data: { rows, rowCount: rows.length },
      }
    },
  }
}

export function createAllSqlToolDefinitions(defs: SqlToolDef[]): ToolDefinition[] {
  return defs.map(createSqlToolDefinition)
}
