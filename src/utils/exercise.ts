import type { Exercise, ResolvedExercise } from '@/types'

/**
 * 动作数据规范化工具。
 *
 * 训练计划的历史数据只含 id/name/sets?/reps?/note?。新执行模块引入
 * type/duration/restSeconds 后，历史动作必须能在不修改数据的前提下继续工作。
 * 所有对动作配置（组数 / 类型 / 时长 / 休息）的读取都统一走这里。
 */

/** 从次数文本中推断秒数，如 "50s"、"50秒"、"20 秒" → 50 */
function parseSeconds(text: string | undefined): number | null {
  if (!text) return null
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:s|秒)/i)
  if (!match) return null
  const value = Math.ceil(Number(match[1]))
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * 将任意版本的 Exercise 规范化为执行模块使用的完整结构。
 * - 无 type：若 reps 含秒数（如 "50s"）推断为计时训练，否则为次数训练。
 * - 无 sets：默认 1 组（时长类动作历史上不写组数）。
 * - 无 duration：从 reps 解析秒数，解析不到给默认值 30。
 * - 无 restSeconds：默认 0（不显示组间休息）。
 */
export function normalizeExercise(ex: Exercise): ResolvedExercise {
  const parsedSeconds = parseSeconds(ex.reps)
  const type = ex.type ?? (parsedSeconds != null ? 'timer' : 'reps')
  return {
    id: ex.id,
    name: ex.name,
    type,
    sets: Math.max(1, Math.floor(ex.sets ?? 1)),
    reps: ex.reps ?? '',
    duration: Math.max(1, Math.floor(ex.duration ?? parsedSeconds ?? 30)),
    restSeconds: Math.max(0, Math.floor(ex.restSeconds ?? 0)),
    note: ex.note ?? ''
  }
}

/**
 * 动作的用量文案：次数训练 → "3 × 12–15"，计时训练 → "3 × 20秒"。
 * 首页列表、训练页共用同一份格式，避免两处各写一套拼接逻辑。
 */
export function formatAmount(ex: ResolvedExercise): string {
  if (ex.type === 'timer') return `${ex.sets} × ${ex.duration}秒`
  if (ex.sets > 1) return ex.reps ? `${ex.sets} × ${ex.reps}` : `${ex.sets} 组`
  return ex.reps
}
