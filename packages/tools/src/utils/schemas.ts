/**
 * 共享 JSON Schema 片段
 */

export const timeParamProperties = {
  start_time: {
    type: 'string' as const,
    description: '起始时间, 格式: YYYY-MM-DD HH:mm',
  },
  end_time: {
    type: 'string' as const,
    description: '结束时间, 格式: YYYY-MM-DD HH:mm',
  },
}
