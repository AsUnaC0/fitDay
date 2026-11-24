export type WorkoutStatus = 'not_started' | 'in_progress' | 'completed'

/**
 * 单个锻炼动作。
 * - sets：组数（正整数）。部分时长类动作（如快走 30 分钟）无组数，故可选。
 * - reps：次数 / 时长文本。保留 string 以兼容现有计划中的 '8–12'、'30 分钟'、
 *   '10s × 15 组'、'50s' 等表达；编辑页会校验非空。
 * - id：稳定唯一 ID，用户修改名称/组数/次数时保持不变，用于保留完成状态。
 */
export interface Exercise {
  id: string
  name: string
  sets?: number
  reps?: string
  note?: string
}

/** 某一天的训练安排。无 exercises 即视为休息日。 */
export interface WorkoutDay {
  weekday: number // 1=周一 ... 7=周日
  title?: string
  exercises: Exercise[]
  notes?: string
  isRestDay?: boolean
}

/** 一套完整的一周训练计划 */
export interface WorkoutPlan {
  id: string
  name: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
  days: WorkoutDay[]
}

/** 某一天、某个计划的训练进度（按 date + planId 唯一定位） */
export interface WorkoutProgress {
  date: string
  planId: string
  completedExerciseIds: string[]
  status: WorkoutStatus
}
