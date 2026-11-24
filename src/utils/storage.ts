import { Preferences } from '@capacitor/preferences'
import { PRESET_PLANS } from '@/data/presetPlans'
import type { Exercise, WorkoutPlan, WorkoutProgress, TimerState } from '@/types'

/**
 * 本地持久化层。全部基于 Capacitor Preferences（原生持久化），
 * 浏览器 / 异常情况下回退到 localStorage。
 *
 * 三组数据分别存储：
 * - workout_plans：所有训练计划
 * - default_workout_plan_id：默认计划 ID
 * - workout_progress：每日进度数组（按 date + planId 隔离）
 */
const KEYS = {
  plans: 'workout_plans',
  defaultPlanId: 'default_workout_plan_id',
  progress: 'workout_progress',
  // 旧版本单条进度（迁移来源，迁移后保留不删）
  legacyProgress: 'fitday:workout-progress',
  // 预设计划注入版本：记录已注入过哪一批预设，避免用户删除后被重复加回
  presetVersion: 'fitday:preset-version'
} as const

/**
 * 当前预设计划版本。新增/更新预设计划时递增，老用户下次启动会自动迁移。
 * v2：移除旧种子计划「我的训练计划」，仅保留哑铃训练 / 徒手训练，默认切到哑铃训练。
 * v3：为预设动作补充训练执行元数据（type/duration/restSeconds），按动作 id 合并，不覆盖用户编辑。
 */
const PRESET_VERSION = '3'

/** 旧种子计划 ID（v1 及以前自动生成），迁移时移除 */
const LEGACY_SEED_PLAN_ID = 'plan-default-seed'

/** 通用读取：Preferences 优先，localStorage 兜底 */
async function read(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key })
    if (value != null) return value
  } catch {
    // 继续尝试 localStorage
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 通用写入：Preferences 与 localStorage 双写 */
async function write(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value })
  } catch {
    // 忽略，依赖 localStorage 兜底
  }
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式下可能不可用，忽略
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function idleTimer(): TimerState {
  return { kind: null, status: 'idle', endAt: null, remaining: 0, duration: 0 }
}

/** 生成一个唯一 ID（时间戳 + 随机串，复制计划时也用它） */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 把最新预设中的执行元数据合并到本地已有计划（仅限预设 id）。
 * 只补 type/duration/restSeconds 字段，且仅当最新预设明确配置了才写入；
 * 用户的 name/sets/reps/note 等编辑保持不变。
 */
function mergePresetExerciseMeta(plan: WorkoutPlan): WorkoutPlan {
  const source = PRESET_PLANS.find((p) => p.id === plan.id)
  if (!source) return plan
  const metaById = new Map<string, Exercise>()
  source.days.forEach((d) => d.exercises.forEach((ex) => metaById.set(ex.id, ex)))

  let changed = false
  const days = plan.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      const meta = metaById.get(ex.id)
      if (!meta) return ex
      const merged: Exercise = { ...ex }
      if (meta.type != null && merged.type == null) {
        merged.type = meta.type
        changed = true
      }
      if (meta.duration != null && merged.duration == null) {
        merged.duration = meta.duration
        changed = true
      }
      if (meta.restSeconds != null && merged.restSeconds == null) {
        merged.restSeconds = meta.restSeconds
        changed = true
      }
      return merged
    })
  }))
  return changed ? { ...plan, days } : plan
}

/**
 * 按预设版本迁移内置计划。
 * - 补齐本地缺失的预设（按 id 判定），不覆盖用户保留的计划。
 * - v2 起移除旧种子计划「我的训练计划」并清理其进度，默认切到哑铃训练。
 * - v3 起为预设动作补充执行元数据（type/duration/restSeconds），按 id 合并。
 * - 迁移后记录版本，用户主动删除的预设不会被重复加回。
 */
async function ensurePresetPlans(plans: WorkoutPlan[]): Promise<WorkoutPlan[]> {
  const currentVersion = await read(KEYS.presetVersion)
  if (currentVersion === PRESET_VERSION) return plans

  // 1) 移除旧种子计划（v1 及以前自动生成），保留其余全部计划
  const hadLegacySeed = plans.some((p) => p.id === LEGACY_SEED_PLAN_ID)
  let merged = plans.filter((p) => p.id !== LEGACY_SEED_PLAN_ID)

  // 2) 补齐缺失的内置预设
  const existingIds = new Set(merged.map((p) => p.id))
  const missing = PRESET_PLANS.filter((p) => !existingIds.has(p.id))
  merged = [...merged, ...missing.map((p) => JSON.parse(JSON.stringify(p)) as WorkoutPlan)]

  // 2.5) v3：为已存在的预设动作补充执行元数据，按动作 id 合并，不覆盖用户编辑。
  merged = merged.map((plan) => mergePresetExerciseMeta(plan))

  // 3) 默认计划指向被移除的种子计划时，切到哑铃训练
  const storedDefault = await loadDefaultPlanId()
  if (hadLegacySeed && (!storedDefault || storedDefault === LEGACY_SEED_PLAN_ID)) {
    const firstPreset = PRESET_PLANS[0]
    if (merged.some((p) => p.id === firstPreset.id)) {
      merged.forEach((p) => (p.isDefault = p.id === firstPreset.id))
      await write(KEYS.defaultPlanId, firstPreset.id)
    }
  }

  // 4) 清理被移除计划的进度记录
  if (hadLegacySeed) {
    const all = await loadAllProgress()
    const cleaned = all.filter((p) => p.planId !== LEGACY_SEED_PLAN_ID)
    if (cleaned.length !== all.length) await saveAllProgress(cleaned)
  }

  await write(KEYS.plans, JSON.stringify(merged))
  await write(KEYS.presetVersion, PRESET_VERSION)
  return merged
}

/**
 * 读取所有计划。若从未初始化，则直接写入内置的两套预设计划
 * （哑铃训练为默认）。已存在用户数据时不覆盖，仅按版本做迁移。
 */
export async function loadPlans(): Promise<WorkoutPlan[]> {
  const raw = await read(KEYS.plans)
  if (raw) {
    const plans = parse<WorkoutPlan[]>(raw, [])
    if (Array.isArray(plans) && plans.length > 0) {
      return ensurePresetPlans(plans)
    }
  }

  // 首次启动：只写内置预设，不再生成「我的训练计划」
  const initial = PRESET_PLANS.map((p) => JSON.parse(JSON.stringify(p)) as WorkoutPlan)
  initial.forEach((p) => (p.isDefault = p.id === PRESET_PLANS[0].id))
  await write(KEYS.plans, JSON.stringify(initial))
  await write(KEYS.defaultPlanId, PRESET_PLANS[0].id)
  await write(KEYS.presetVersion, PRESET_VERSION)
  await migrateLegacyProgress(PRESET_PLANS[0].id)
  return initial
}

export async function savePlans(plans: WorkoutPlan[]): Promise<void> {
  await write(KEYS.plans, JSON.stringify(plans))
}

export async function loadDefaultPlanId(): Promise<string | null> {
  const value = await read(KEYS.defaultPlanId)
  return value && value.length > 0 ? value : null
}

export async function saveDefaultPlanId(id: string): Promise<void> {
  await write(KEYS.defaultPlanId, id)
}

/** 读取全部进度记录，并把历史结构升级为当前结构 */
export async function loadAllProgress(): Promise<WorkoutProgress[]> {
  const raw = await read(KEYS.progress)
  const list = parse<unknown[]>(raw, [])
  if (!Array.isArray(list)) return []
  return list.map((item) => migrateProgressRecord(item)).filter(Boolean) as WorkoutProgress[]
}

export async function saveAllProgress(list: WorkoutProgress[]): Promise<void> {
  await write(KEYS.progress, JSON.stringify(list))
}

/**
 * 把任意历史版本的进度记录升级为当前结构。
 * 历史记录里的 status / phase / version / completedExerciseIds 一律忽略：
 * 完成状态由 exerciseProgress 完整表达，休息状态由 timer.kind 表达。
 */
function migrateProgressRecord(item: unknown): WorkoutProgress | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Partial<WorkoutProgress> & { completedExerciseIds?: string[] }
  if (!raw.date || !raw.planId) return null

  const exerciseProgress =
    raw.exerciseProgress && typeof raw.exerciseProgress === 'object' ? raw.exerciseProgress : {}

  // v1：没有任何按组记录，但存在按动作记录的完成列表 → 转为"整项完成"
  const legacyIds = Array.isArray(raw.completedExerciseIds) ? raw.completedExerciseIds : []
  if (Object.keys(exerciseProgress).length === 0 && legacyIds.length > 0) {
    legacyIds.forEach((id) => {
      exerciseProgress[id] = { completedSets: 1, completed: true }
    })
  }

  return {
    date: raw.date,
    planId: raw.planId,
    currentExerciseId: raw.currentExerciseId ?? '',
    exerciseProgress,
    timer: raw.timer ?? idleTimer()
  }
}

/**
 * 将很早以前的单条进度 key 迁移到多计划结构。
 * 仅在新结构缺失对应记录时写入，避免覆盖用户新进度；迁移后保留旧 key。
 */
async function migrateLegacyProgress(defaultPlanId: string): Promise<void> {
  const raw = await read(KEYS.legacyProgress)
  if (!raw) return
  const legacy = parse<{ date: string; completedExerciseIds: string[] } | null>(raw, null)
  if (!legacy || !legacy.date || !Array.isArray(legacy.completedExerciseIds)) return

  const existing = await loadAllProgress()
  const alreadyMigrated = existing.some(
    (p) => p.date === legacy.date && p.planId === defaultPlanId
  )
  if (alreadyMigrated) return

  const progress: WorkoutProgress = {
    date: legacy.date,
    planId: defaultPlanId,
    currentExerciseId: legacy.completedExerciseIds[0] ?? '',
    exerciseProgress: {},
    timer: idleTimer()
  }
  legacy.completedExerciseIds.forEach((id) => {
    progress.exerciseProgress[id] = { completedSets: 1, completed: true }
  })
  existing.push(progress)
  await saveAllProgress(existing)
}
