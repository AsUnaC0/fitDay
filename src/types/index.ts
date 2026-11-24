/** 训练类型：次数训练 / 计时训练 */
export type ExerciseType = 'reps' | 'timer'

/**
 * 单个锻炼动作（存储结构）。
 * - type 缺省时按 reps 文本推断（含"秒"视为计时训练），由 normalizeExercise 统一解析。
 * - sets 缺省按 1 组处理（时长类动作历史上不写组数）。
 * - reps 保留 string，以承载 '8–12'、'30 分钟' 等表达。
 * - duration：计时训练每组秒数；restSeconds：组间休息秒数，>0 才进入休息计时。
 */
export interface Exercise {
  id: string
  name: string
  type?: ExerciseType
  sets?: number
  reps?: string
  duration?: number
  restSeconds?: number
  note?: string
}

/** 规范化后的动作：所有训练执行逻辑只消费此结构 */
export interface ResolvedExercise {
  id: string
  name: string
  type: ExerciseType
  sets: number
  reps: string
  duration: number
  restSeconds: number
  note: string
}

/** 某一天的训练安排。无 exercises 即视为休息日。 */
export interface WorkoutDay {
  weekday: number // 1=周一 ... 7=周日
  title?: string
  notes?: string
  exercises: Exercise[]
  isRestDay?: boolean
}

/** 一套一周训练计划 */
export interface WorkoutPlan {
  id: string
  name: string
  isDefault: boolean
  days: WorkoutDay[]
}

/** 单个动作的完成状态：按组记录 */
export interface ExerciseProgress {
  completedSets: number
  completed: boolean
}

/** 计时用途：训练计时 / 组间休息计时 */
export type TimerKind = 'work' | 'rest'

/** 计时器运行状态 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

/**
 * 持久化计时状态。
 * - endAt：运行时的结束时间戳（毫秒），真实剩余时间由此计算，不依赖 tick 累计。
 * - remaining：暂停时记录的剩余秒数。
 * - duration：本轮总秒数，用于重置与进度显示。
 * - kind：'rest' 即代表当前处于组间休息，无需额外的阶段字段。
 */
export interface TimerState {
  kind: TimerKind | null
  status: TimerStatus
  endAt: number | null
  remaining: number
  duration: number
}

/** 某一天、某个计划的训练进度（按 date + planId 唯一定位） */
export interface WorkoutProgress {
  date: string
  planId: string
  currentExerciseId: string
  exerciseProgress: Record<string, ExerciseProgress>
  timer: TimerState
}
