import { Preferences } from '@capacitor/preferences'
import { workoutPlan as seedPlan } from '@/data/workoutPlan'
import type { WorkoutPlan, WorkoutProgress } from '@/types'

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
  legacyProgress: 'fitday:workout-progress'
} as const

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

/** 生成一个唯一 ID（时间戳 + 随机串，复制计划时也用它） */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 将静态种子数据转换为第一条计划 */
function createSeedPlan(): WorkoutPlan {
  const now = Date.now()
  return {
    id: 'plan-default-seed',
    name: '我的训练计划',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    // 深拷贝，避免与静态数据引用共享
    days: JSON.parse(JSON.stringify(seedPlan)) as WorkoutPlan['days']
  }
}

/**
 * 读取所有计划。若从未初始化，则执行一次性迁移：
 * 用现有版本 workoutPlan.ts 数据生成默认计划并落盘。
 * 已存在用户数据时绝不覆盖。
 */
export async function loadPlans(): Promise<WorkoutPlan[]> {
  const raw = await read(KEYS.plans)
  if (raw) {
    const plans = parse<WorkoutPlan[]>(raw, [])
    if (Array.isArray(plans) && plans.length > 0) return plans
  }

  // 首次启动：迁移种子数据为默认计划
  const seed = createSeedPlan()
  await write(KEYS.plans, JSON.stringify([seed]))
  await write(KEYS.defaultPlanId, seed.id)
  await migrateLegacyProgress(seed.id)
  return [seed]
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

/** 读取全部进度记录 */
export async function loadAllProgress(): Promise<WorkoutProgress[]> {
  const raw = await read(KEYS.progress)
  const list = parse<WorkoutProgress[]>(raw, [])
  return Array.isArray(list) ? list : []
}

export async function saveAllProgress(list: WorkoutProgress[]): Promise<void> {
  await write(KEYS.progress, JSON.stringify(list))
}

/**
 * 将旧版本单条进度迁移到新结构，关联到指定计划。
 * 迁移成功后保留旧 key（不删除），仅在新结构缺失记录时写入，避免覆盖用户新进度。
 */
async function migrateLegacyProgress(defaultPlanId: string): Promise<void> {
  const raw = await read(KEYS.legacyProgress)
  if (!raw) return
  const legacy = parse<{
    date: string
    completedExerciseIds: string[]
    status?: WorkoutProgress['status']
  } | null>(raw, null)
  if (!legacy || !legacy.date || !Array.isArray(legacy.completedExerciseIds)) return

  const existing = await loadAllProgress()
  const alreadyMigrated = existing.some(
    (p) => p.date === legacy.date && p.planId === defaultPlanId
  )
  if (alreadyMigrated) return

  existing.push({
    date: legacy.date,
    planId: defaultPlanId,
    completedExerciseIds: legacy.completedExerciseIds,
    status: legacy.status ?? 'in_progress'
  })
  await saveAllProgress(existing)
}
