/** 星期标签，索引与 weekday（1=周一 ... 7=周日）一一对应 */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六',
  7: '星期日'
}

/** 返回 YYYY-MM-DD，使用本地时区（不使用会转成 UTC 的 toISOString） */
export function getDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** JS getDay(): 0=周日；本项目约定: 1=周一 ... 7=周日 */
export function getWeekday(date: Date = new Date()): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/** 格式化为 2026年11月23日 */
export function formatChineseDate(date: Date = new Date()): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
