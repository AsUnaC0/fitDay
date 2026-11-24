export type WorkoutStatus = 'not_started' | 'in_progress' | 'completed'

/** 训练类型：次数训练 / 计时训练 */
export type ExerciseType = 'reps' | 'timer'

/**
 * 单个锻炼动作。
 * - type：默认 'reps'。旧数据无此字段时按次数训练处理，保证兼容。
 * - sets：组数。旧数据中时长类动作（如快走 30 分钟）没有组数，故此字段可选，
 *   读取时由 normalizeExercise 统一解析为至少 1 组。
 * - reps：次数 / 时长文本，保留 string 以兼容 '8–12'、'30 分钟'、'50s' 等表达。
 * - duration：计时训练每组秒数（type==='timer' 时生效）。
 * - restSeconds：组间休息秒数，>0 才显示休息计时。
 * - id：稳定唯一 ID，用于保留完成状态。
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

/** 单个动作的完成状态：按组记录 */
export interface ExerciseProgress {
  completedSets: number
  completed: boolean
}

/** 训练阶段 */
export type TrainingPhase = 'ready' | 'working' | 'resting' | 'finished'

/** 计时用途：训练计时 / 组间休息计时 */
export type TimerKind = 'work' | 'rest'

/** 计时器运行状态 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

/**
 * 持久化计时状态。
 * - endAt：运行时的结束时间戳（毫秒），真实剩余时间由此计算，不依赖 tick 累计。
 * - remaining：暂停时记录的剩余秒数。
 * - duration：本轮总秒数，用于重置与进度显示。
 */
export interface TimerState {
  kind: TimerKind | null
  status: TimerStatus
  endAt: number | null
  remaining: number
  duration: number
}

/** 缓存结构版本：结构变更时递增，便于未来迁移 */
export const PROGRESS_VERSION = 2

/**
 * 某一天、某个计划的训练进度（按 date + planId 唯一定位）。
 * v1 仅有 completedExerciseIds，升级时由 storage 迁移为 exerciseProgress。
 */
export interface WorkoutProgress {
  version: number
  date: string
  planId: string
  status: WorkoutStatus
  currentExerciseId: string
  exerciseProgress: Record<string, ExerciseProgress>
  phase: TrainingPhase
  timer: TimerState
  /** v1 遗留字段，迁移后保留以便回滚兼容，不参与运行逻辑 */
  completedExerciseIds?: string[]
}
