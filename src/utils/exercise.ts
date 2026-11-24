import type { Exercise, ResolvedExercise, ExerciseProgress } from '@/types'

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
  const sets = Math.max(1, Math.floor(ex.sets ?? 1))
  return {
    id: ex.id,
    name: ex.name,
    type,
    sets,
    reps: ex.reps ?? '',
    duration: Math.max(1, Math.floor(ex.duration ?? parsedSeconds ?? 30)),
    restSeconds: Math.max(0, Math.floor(ex.restSeconds ?? 0)),
    note: ex.note ?? ''
  }
}

/** 批量规范化 */
export function normalizeExercises(list: Exercise[]): ResolvedExercise[] {
  return list.map(normalizeExercise)
}

/** 创建一个全新的动作进度 */
export function createExerciseProgress(): ExerciseProgress {
  return { completedSets: 0, completed: false }
}
