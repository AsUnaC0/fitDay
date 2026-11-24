import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Exercise, WorkoutDay, WorkoutPlan, WorkoutProgress } from '@/types'
import {
  WEEKDAY_LABELS,
  formatChineseDate,
  getDateKey,
  getWeekday
} from '@/utils/date'
import {
  generateId,
  loadAllProgress,
  loadDefaultPlanId,
  loadPlans,
  saveAllProgress,
  saveDefaultPlanId,
  savePlans
} from '@/utils/storage'

function createEmptyProgress(date: string, planId: string): WorkoutProgress {
  return { date, planId, completedExerciseIds: [], status: 'not_started' }
}

/** 返回一套计划中某天的训练安排 */
function dayOf(plan: WorkoutPlan | null, weekday: number): WorkoutDay | null {
  return plan?.days.find((d) => d.weekday === weekday) ?? null
}

export const useWorkoutStore = defineStore('workout', () => {
  /** 异步读取缓存完成前为 false，避免页面闪烁 */
  const isReady = ref(false)
  const now = ref(new Date())
  const dateKey = ref(getDateKey(now.value))

  // ---- 多计划状态 ----
  const plans = ref<WorkoutPlan[]>([])
  const defaultPlanId = ref<string>('')
  const allProgress = ref<WorkoutProgress[]>([])
  /** 当前生效的进度记录（date + 默认计划），视图通过它读取完成状态 */
  const progress = ref<WorkoutProgress>(
    createEmptyProgress(dateKey.value, '')
  )

  // ---- 派生：今日训练数据来自「默认计划」 ----
  const defaultPlan = computed<WorkoutPlan | null>(
    () =>
      plans.value.find((p) => p.id === defaultPlanId.value) ??
      plans.value.find((p) => p.isDefault) ??
      plans.value[0] ??
      null
  )

  /** 今日计划（保留原名，兼容现有视图） */
  const todayPlan = computed<WorkoutDay | null>(() =>
    dayOf(defaultPlan.value, getWeekday(now.value))
  )

  const title = computed(() => todayPlan.value?.title ?? '今日无训练计划')
  const notes = computed(() => todayPlan.value?.notes ?? '')
  const isRestDay = computed(
    () => todayPlan.value?.isRestDay ?? (todayPlan.value?.exercises.length ?? 0) === 0
  )
  const exercises = computed<Exercise[]>(() => todayPlan.value?.exercises ?? [])
  const total = computed(() => exercises.value.length)

  const dateLabel = computed(() => formatChineseDate(now.value))
  const weekdayLabel = computed(
    () => WEEKDAY_LABELS[getWeekday(now.value)] ?? `星期${getWeekday(now.value)}`
  )
  const planName = computed(() => defaultPlan.value?.name ?? '')

  const completedCount = computed(() =>
    exercises.value.filter((ex) => progress.value.completedExerciseIds.includes(ex.id)).length
  )

  /** 是否全部完成：以「当前计划动作是否全部打卡」为准，改计划后即时反映 */
  const isCompleted = computed(
    () => !isRestDay.value && total.value > 0 && completedCount.value >= total.value
  )

  const currentExercise = computed<Exercise | null>(
    () =>
      exercises.value.find((ex) => !progress.value.completedExerciseIds.includes(ex.id)) ?? null
  )

  const currentIndex = computed(() => {
    const current = currentExercise.value
    return current ? exercises.value.findIndex((ex) => ex.id === current.id) : -1
  })

  const currentStep = computed(() =>
    currentIndex.value >= 0 ? currentIndex.value + 1 : total.value
  )

  const isExerciseCompleted = (id: string): boolean =>
    progress.value.completedExerciseIds.includes(id)

  // ---- 进度存取 ----
  /** 从 allProgress 中找出「当前日期 + 默认计划」的记录，没有则新建 */
  function syncActiveProgress(): void {
    const planId = defaultPlan.value?.id ?? ''
    const found = allProgress.value.find(
      (p) => p.date === dateKey.value && p.planId === planId
    )
    progress.value = found ?? createEmptyProgress(dateKey.value, planId)
  }

  /** 把当前 progress 写回 allProgress 并持久化 */
  async function persistProgress(): Promise<void> {
    const idx = allProgress.value.findIndex(
      (p) => p.date === progress.value.date && p.planId === progress.value.planId
    )
    if (idx >= 0) allProgress.value[idx] = progress.value
    else allProgress.value.push(progress.value)
    await saveAllProgress(allProgress.value)
  }

  /** 启动：加载计划 → 确定默认 → 清理非当天进度 → 恢复当天进度 */
  async function init(): Promise<void> {
    const today = getDateKey()
    dateKey.value = today
    now.value = new Date()

    const loadedPlans = await loadPlans()
    const storedDefaultId = await loadDefaultPlanId()
    plans.value = loadedPlans

    // 确定默认计划 ID：存储值有效则用它，否则取 isDefault，再否则取第一条
    const validDefault =
      loadedPlans.find((p) => p.id === storedDefaultId) ??
      loadedPlans.find((p) => p.isDefault) ??
      loadedPlans[0]
    defaultPlanId.value = validDefault?.id ?? ''

    // 保证 isDefault 标记与 defaultPlanId 一致（数据完整性）
    if (validDefault) {
      let changed = false
      loadedPlans.forEach((p) => {
        const shouldBe = p.id === validDefault.id
        if (p.isDefault !== shouldBe) {
          p.isDefault = shouldBe
          changed = true
        }
      })
      if (changed) await savePlans(loadedPlans)
      await saveDefaultPlanId(validDefault.id)
    }

    // 只保留当天的进度记录（跨天清理），不区分计划
    const all = await loadAllProgress()
    allProgress.value = all.filter((p) => p.date === today)
    await saveAllProgress(allProgress.value)

    syncActiveProgress()
    isReady.value = true
  }

  /** 从后台恢复：检测跨天。返回 true 表示日期变化，调用方可跳首页 */
  async function refreshToday(): Promise<boolean> {
    const today = getDateKey()
    const dateChanged = today !== dateKey.value
    if (dateChanged) {
      dateKey.value = today
      // 清理非当天进度
      allProgress.value = allProgress.value.filter((p) => p.date === today)
      await saveAllProgress(allProgress.value)
      syncActiveProgress()
    }
    now.value = new Date()
    return dateChanged
  }

  // ---- 训练执行（流程保持不变） ----
  async function start(): Promise<void> {
    if (isRestDay.value || total.value === 0) return
    progress.value.status = 'in_progress'
    await persistProgress()
  }

  async function completeCurrent(): Promise<void> {
    const current = currentExercise.value
    if (!current) return

    progress.value.completedExerciseIds.push(current.id)
    progress.value.status =
      progress.value.completedExerciseIds.length >= total.value ? 'completed' : 'in_progress'
    await persistProgress()
  }

  async function previous(): Promise<void> {
    const doneSet = new Set(progress.value.completedExerciseIds)
    let lastDoneId: string | null = null
    for (const ex of exercises.value) {
      if (doneSet.has(ex.id)) lastDoneId = ex.id
    }
    if (!lastDoneId) return

    progress.value.completedExerciseIds = progress.value.completedExerciseIds.filter(
      (id) => id !== lastDoneId
    )
    progress.value.status = 'in_progress'
    await persistProgress()
  }

  async function reset(): Promise<void> {
    progress.value = createEmptyProgress(dateKey.value, defaultPlanId.value)
    await persistProgress()
  }

  // ---- 计划管理 ----
  function getPlanById(id: string): WorkoutPlan | null {
    return plans.value.find((p) => p.id === id) ?? null
  }

  /** 统计某套计划：训练天数与动作总数 */
  function planStats(plan: WorkoutPlan): { days: number; exercises: number } {
    const activeDays = plan.days.filter((d) => (d.exercises?.length ?? 0) > 0)
    return {
      days: activeDays.length,
      exercises: activeDays.reduce((sum, d) => sum + d.exercises.length, 0)
    }
  }

  /** 设某计划为默认（全局唯一） */
  async function setDefaultPlan(id: string): Promise<void> {
    const target = plans.value.find((p) => p.id === id)
    if (!target) return
    plans.value.forEach((p) => {
      p.isDefault = p.id === id
      p.updatedAt = Date.now()
    })
    defaultPlanId.value = id
    await savePlans(plans.value)
    await saveDefaultPlanId(id)
    // 默认计划变了，切换到该计划的当天进度，首页即时刷新
    syncActiveProgress()
  }

  /**
   * 新建或更新计划。
   * - 传入 id 为空 → 新建；否则更新对应计划。
   * - 编辑动作时按 id 对比：被删除的动作从所有进度中清理其完成记录；
   *   保留 id 的动作完成状态自然保留；新增动作是新 id，天然未完成。
   * - setDefault 为 true 时，该计划成为唯一默认。
   * 返回保存后的计划 id。
   */
  async function savePlan(
    input: {
      id?: string
      name: string
      days: WorkoutDay[]
      setDefault: boolean
    }
  ): Promise<string> {
    const nowTs = Date.now()
    let planId = input.id

    if (planId && getPlanById(planId)) {
      // 更新：对比旧动作 id，清理已删除动作的完成记录
      const old = getPlanById(planId)!
      const oldIds = new Set<string>()
      old.days.forEach((d) => d.exercises.forEach((ex) => oldIds.add(ex.id)))
      const newIds = new Set<string>()
      input.days.forEach((d) => d.exercises.forEach((ex) => newIds.add(ex.id)))
      const removedIds = [...oldIds].filter((id) => !newIds.has(id))

      if (removedIds.length > 0) {
        allProgress.value.forEach((p) => {
          p.completedExerciseIds = p.completedExerciseIds.filter((id) => !removedIds.includes(id))
        })
        await saveAllProgress(allProgress.value)
        // 同步当前活动进度引用
        syncActiveProgress()
      }

      const idx = plans.value.findIndex((p) => p.id === planId)
      plans.value[idx] = {
        ...old,
        name: input.name,
        days: JSON.parse(JSON.stringify(input.days)) as WorkoutDay[],
        updatedAt: nowTs
      }
    } else {
      // 新建
      planId = generateId('plan')
      const newPlan: WorkoutPlan = {
        id: planId,
        name: input.name,
        isDefault: false,
        createdAt: nowTs,
        updatedAt: nowTs,
        days: JSON.parse(JSON.stringify(input.days)) as WorkoutDay[]
      }
      plans.value.push(newPlan)
    }

    if (input.setDefault) {
      plans.value.forEach((p) => {
        p.isDefault = p.id === planId
      })
      defaultPlanId.value = planId!
      await saveDefaultPlanId(planId!)
    }

    await savePlans(plans.value)
    if (input.setDefault) syncActiveProgress()
    return planId!
  }

  /** 复制计划：生成新 ID（计划与所有动作），不复制完成记录 */
  async function duplicatePlan(id: string): Promise<void> {
    const source = getPlanById(id)
    if (!source) return
    const nowTs = Date.now()
    const newDays: WorkoutDay[] = JSON.parse(JSON.stringify(source.days))
    newDays.forEach((d) => {
      d.exercises.forEach((ex) => {
        ex.id = generateId('ex')
      })
    })
    const copy: WorkoutPlan = {
      id: generateId('plan'),
      name: `${source.name}（副本）`,
      isDefault: false,
      createdAt: nowTs,
      updatedAt: nowTs,
      days: newDays
    }
    plans.value.push(copy)
    await savePlans(plans.value)
  }

  /** 删除计划。返回是否成功；不允许删除最后一套。 */
  async function deletePlan(id: string): Promise<{ ok: boolean; reason?: string }> {
    if (plans.value.length <= 1) {
      return { ok: false, reason: '至少需要保留一套训练计划' }
    }
    const target = getPlanById(id)
    if (!target) return { ok: false, reason: '计划不存在' }

    const wasDefault = target.isDefault || defaultPlanId.value === id
    plans.value = plans.value.filter((p) => p.id !== id)

    // 清理该计划的所有进度记录
    allProgress.value = allProgress.value.filter((p) => p.planId !== id)
    await saveAllProgress(allProgress.value)

    if (wasDefault) {
      // 默认计划被删，自动接管为第一套（UI 会提示用户选择其他默认计划）
      const next = plans.value[0]
      plans.value.forEach((p) => {
        p.isDefault = p.id === next.id
      })
      defaultPlanId.value = next.id
      await saveDefaultPlanId(next.id)
    }

    await savePlans(plans.value)
    syncActiveProgress()
    return { ok: true }
  }

  /** 为编辑页生成动作 ID 供新增动作用 */
  function newExerciseId(): string {
    return generateId('ex')
  }

  return {
    // 现有视图使用的状态
    isReady,
    now,
    dateKey,
    progress,
    todayPlan,
    title,
    notes,
    isRestDay,
    exercises,
    total,
    dateLabel,
    weekdayLabel,
    planName,
    completedCount,
    isCompleted,
    currentExercise,
    currentIndex,
    currentStep,
    isExerciseCompleted,
    // 计划管理
    plans,
    defaultPlanId,
    defaultPlan,
    getPlanById,
    planStats,
    setDefaultPlan,
    savePlan,
    duplicatePlan,
    deletePlan,
    newExerciseId,
    // 生命周期 / 训练
    init,
    refreshToday,
    start,
    completeCurrent,
    previous,
    reset
  }
})
