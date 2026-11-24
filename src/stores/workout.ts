import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Exercise,
  ResolvedExercise,
  WorkoutDay,
  WorkoutPlan,
  WorkoutProgress,
  ExerciseProgress,
  TimerKind,
  TimerState,
  TrainingPhase
} from '@/types'
import { PROGRESS_VERSION } from '@/types'
import {
  WEEKDAY_LABELS,
  formatChineseDate,
  getDateKey,
  getWeekday
} from '@/utils/date'
import { createExerciseProgress, normalizeExercises } from '@/utils/exercise'
import {
  generateId,
  loadAllProgress,
  loadDefaultPlanId,
  loadPlans,
  saveAllProgress,
  saveDefaultPlanId,
  savePlans
} from '@/utils/storage'

/** 创建一个全新的空计时状态 */
function idleTimer(): TimerState {
  return { kind: null, status: 'idle', endAt: null, remaining: 0, duration: 0 }
}

/** 根据结束时间戳计算剩余秒数（向上取整，保证显示到 0 才结束） */
function remainingSeconds(timer: TimerState, now: number = Date.now()): number {
  if (timer.status === 'running' && timer.endAt != null) {
    return Math.max(0, Math.ceil((timer.endAt - now) / 1000))
  }
  return Math.max(0, Math.floor(timer.remaining))
}

function createEmptyProgress(date: string, planId: string): WorkoutProgress {
  return {
    version: PROGRESS_VERSION,
    date,
    planId,
    status: 'not_started',
    currentExerciseId: '',
    exerciseProgress: {},
    phase: 'ready',
    timer: idleTimer()
  }
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
  const progress = ref<WorkoutProgress>(createEmptyProgress(dateKey.value, ''))

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

  /** 今日动作：原始结构（兼容首页列表）与规范化结构（训练执行用） */
  const exercises = computed<Exercise[]>(() => todayPlan.value?.exercises ?? [])
  const resolvedExercises = computed<ResolvedExercise[]>(() => normalizeExercises(exercises.value))
  const total = computed(() => exercises.value.length)

  const dateLabel = computed(() => formatChineseDate(now.value))
  const weekdayLabel = computed(
    () => WEEKDAY_LABELS[getWeekday(now.value)] ?? `星期${getWeekday(now.value)}`
  )
  const planName = computed(() => defaultPlan.value?.name ?? '')

  // ---- 当前动作 / 当前组 ----
  const currentExercise = computed<ResolvedExercise | null>(() => {
    const id = progress.value.currentExerciseId
    return resolvedExercises.value.find((ex) => ex.id === id) ?? null
  })
  const currentIndex = computed(() => {
    const current = currentExercise.value
    return current ? resolvedExercises.value.findIndex((ex) => ex.id === current.id) : -1
  })
  const currentStep = computed(() => (currentIndex.value >= 0 ? currentIndex.value + 1 : total.value))
  const currentPhase = computed<TrainingPhase>(() => progress.value.phase)

  /** 当前动作的进度（始终返回一个新对象的安全视图） */
  function progressOf(exerciseId: string): ExerciseProgress {
    return progress.value.exerciseProgress[exerciseId] ?? { completedSets: 0, completed: false }
  }

  /** 当前组序号：已完成组数 + 1；全部完成时等于总组数 */
  const currentSet = computed(() => {
    const ex = currentExercise.value
    if (!ex) return 0
    return Math.min(progressOf(ex.id).completedSets + 1, ex.sets)
  })

  /** 当前动作是否已全部组完成 */
  const currentSetsDone = computed(() => {
    const ex = currentExercise.value
    if (!ex) return false
    return progressOf(ex.id).completedSets >= ex.sets
  })

  const completedCount = computed(
    () =>
      resolvedExercises.value.filter((ex) => progressOf(ex.id).completed).length
  )
  const isCompleted = computed(
    () => !isRestDay.value && total.value > 0 && completedCount.value >= total.value
  )

  const isExerciseCompleted = (id: string): boolean => progressOf(id).completed

  // ---- 计时状态 ----
  /** 时钟 ref：由 tick 驱动更新，让倒计时的 computed 每秒重新计算（否则依赖的 timer 对象不变会被缓存） */
  const clock = ref(Date.now())
  const timer = computed<TimerState>(() => progress.value.timer)
  const timerStatus = computed(() => progress.value.timer.status)
  const timerKind = computed(() => progress.value.timer.kind)
  const timerRemaining = computed(() => remainingSeconds(progress.value.timer, clock.value))

  /** 供 useCountdown 使用：当前是否在运行 */
  function isTimerRunning(): boolean {
    return progress.value.timer.status === 'running'
  }
  /** 供 useCountdown 使用：结束时间戳 */
  function timerEndAt(): number | null {
    return progress.value.timer.endAt
  }
  /** 供 useCountdown 使用：刷新并返回剩余秒数，到期时改为 finished（不推进进度） */
  function tickTimer(): number {
    clock.value = Date.now()
    if (progress.value.timer.status !== 'running') return remainingSeconds(progress.value.timer, clock.value)
    const remaining = remainingSeconds(progress.value.timer, clock.value)
    if (remaining <= 0) {
      progress.value.timer = {
        ...progress.value.timer,
        status: 'finished',
        endAt: null,
        remaining: 0
      }
      // 计时到期只落盘状态，绝不自动增加已完成组数
      void persistProgress()
    }
    return remaining
  }

  // ---- 进度存取 ----
  function syncActiveProgress(): void {
    const planId = defaultPlan.value?.id ?? ''
    const found = allProgress.value.find(
      (p) => p.date === dateKey.value && p.planId === planId
    )
    progress.value = found ?? createEmptyProgress(dateKey.value, planId)
    // 恢复进度后同步时钟基准，避免用旧 clock 计算正在运行的计时
    clock.value = Date.now()
    // 默认计划切换后，确保当前动作仍属于今日动作，否则定位到第一个未完成项
    ensureCurrentExercise()
  }

  async function persistProgress(): Promise<void> {
    const idx = allProgress.value.findIndex(
      (p) => p.date === progress.value.date && p.planId === progress.value.planId
    )
    if (idx >= 0) allProgress.value[idx] = progress.value
    else allProgress.value.push(progress.value)
    await saveAllProgress(allProgress.value)
  }

  /** 若当前动作无效或已完成，定位到第一个未完成动作 */
  function ensureCurrentExercise(): void {
    const list = resolvedExercises.value
    if (list.length === 0) return
    const current = list.find((ex) => ex.id === progress.value.currentExerciseId)
    if (current && !progressOf(current.id).completed) return
    const next = list.find((ex) => !progressOf(ex.id).completed)
    progress.value.currentExerciseId = next?.id ?? list[list.length - 1].id
    // 定位到新动作时，阶段与计时回到初始
    if (progress.value.phase === 'working' || progress.value.phase === 'resting') {
      progress.value.phase = 'ready'
      progress.value.timer = idleTimer()
    }
  }

  /**
   * 启动 / 恢复今日训练：定位第一个未完成动作。
   * 已有进行中进度时保留当前动作（继续训练）。
   */
  async function start(): Promise<void> {
    if (isRestDay.value || total.value === 0) return
    ensureCurrentExercise()
    progress.value.status = 'in_progress'
    if (progress.value.phase === 'finished' && !currentSetsDone.value) {
      progress.value.phase = 'ready'
    }
    await persistProgress()
  }

  // ---- 训练执行：组 ----
  /**
   * 完成当前组。次数训练与计时训练共用。
   * 计时训练只有在计时已到时（status==='finished'）才允许确认，避免跳过计时。
   * 防重复：本组已完成 / 动作已完成 / 处于休息阶段时一律忽略。
   */
  async function completeSet(): Promise<void> {
    const ex = currentExercise.value
    if (!ex) return
    if (progress.value.phase === 'resting') return
    if (ex.type === 'timer' && progress.value.timer.status !== 'finished') return

    const state = progress.value.exerciseProgress[ex.id] ?? createExerciseProgress()
    if (state.completed || state.completedSets >= ex.sets) return

    state.completedSets += 1
    state.completed = state.completedSets >= ex.sets
    progress.value.exerciseProgress[ex.id] = state
    progress.value.status = 'in_progress'

    // 本动作全部组完成 → 等待用户点"下一项"，不自动跳转
    if (state.completed) {
      progress.value.phase = 'finished'
      progress.value.timer = idleTimer()
    } else if (ex.restSeconds > 0) {
      // 还有剩余组且配置了休息 → 进入组间休息
      startCountdown('rest', ex.restSeconds)
      progress.value.phase = 'resting'
    } else {
      progress.value.phase = 'ready'
      progress.value.timer = idleTimer()
    }
    await persistProgress()
  }

  /** 撤销上一组（把最近完成的一组退回未完成） */
  async function previous(): Promise<void> {
    const ex = currentExercise.value
    if (!ex) return
    const state = progress.value.exerciseProgress[ex.id]
    if (!state || state.completedSets <= 0) return
    state.completedSets -= 1
    state.completed = false
    progress.value.phase = 'ready'
    progress.value.timer = idleTimer()
    await persistProgress()
  }

  // ---- 计时器 ----
  /** 启动一个计时（kind 区分训练计时与休息计时，两者不会同时运行） */
  function startCountdown(kind: TimerKind, seconds: number): void {
    const duration = Math.max(1, Math.floor(seconds))
    const nowTs = Date.now()
    // 同步时钟基准：否则 clock 停留在旧时刻，结束时 endAt(新) - clock(旧) 会出现虚高秒数
    clock.value = nowTs
    progress.value.timer = {
      kind,
      status: 'running',
      endAt: nowTs + duration * 1000,
      remaining: duration,
      duration
    }
  }

  /** 开始当前动作的训练计时（仅次数外的计时训练、且未完成时可用） */
  async function startWorkTimer(): Promise<void> {
    const ex = currentExercise.value
    if (!ex || ex.type !== 'timer') return
    if (progressOf(ex.id).completed) return
    startCountdown('work', ex.duration)
    progress.value.phase = 'working'
    await persistProgress()
  }

  /** 暂停：记录剩余秒数，停止依赖时间戳的倒计时 */
  async function pauseTimer(): Promise<void> {
    const t = progress.value.timer
    if (t.status !== 'running') return
    const nowTs = Date.now()
    const left = remainingSeconds(t, nowTs)
    clock.value = nowTs
    progress.value.timer = {
      ...t,
      status: 'paused',
      endAt: null,
      remaining: left
    }
    await persistProgress()
  }

  /** 继续：用当前剩余秒数重新计算结束时间戳 */
  async function resumeTimer(): Promise<void> {
    const t = progress.value.timer
    if (t.status !== 'paused') return
    const seconds = Math.max(1, Math.floor(t.remaining))
    const nowTs = Date.now()
    clock.value = nowTs
    progress.value.timer = {
      ...t,
      status: 'running',
      endAt: nowTs + seconds * 1000,
      remaining: seconds
    }
    await persistProgress()
  }

  /** 重新计时（当前用途不变，重新开始整段时长） */
  async function resetTimer(): Promise<void> {
    const t = progress.value.timer
    if (!t.kind) return
    startCountdown(t.kind, t.duration)
    progress.value.phase = t.kind === 'rest' ? 'resting' : 'working'
    await persistProgress()
  }

  /** 倒计时到期回调：只落盘 finished 状态并清除阶段标记，绝不自动完成组或跳页 */
  async function onCountdownFinish(): Promise<void> {
    const t = progress.value.timer
    if (t.status !== 'running' || t.kind == null) return
    progress.value.timer = { ...t, status: 'finished', endAt: null, remaining: 0 }
    if (t.kind === 'work') progress.value.phase = 'working'
    if (t.kind === 'rest') progress.value.phase = 'resting'
    await persistProgress()
  }

  /** 跳过组间休息：进入下一组的待开始状态（不增加已完成组数） */
  async function skipRest(): Promise<void> {
    if (progress.value.phase !== 'resting') return
    progress.value.phase = 'ready'
    progress.value.timer = idleTimer()
    await persistProgress()
  }

  // ---- 训练执行：动作 / 完成 ----
  /** 是否允许进入下一项：仅当前动作全组完成时解锁 */
  const canGoNext = computed(() => {
    const ex = currentExercise.value
    return !!ex && progressOf(ex.id).completed
  })

  const isLastExercise = computed(() => currentIndex.value >= 0 && currentIndex.value === total.value - 1)
  const nextButtonText = computed(() => (isLastExercise.value ? '完成今日训练' : '下一项'))

  /**
   * 进入下一个动作。仅在 canGoNext 时生效。
   * 最后一个动作完成后标记今日完成，由视图跳转到完成页。
   */
  async function nextExercise(): Promise<boolean> {
    if (!canGoNext.value) return false
    const list = resolvedExercises.value
    const next = list.find((ex) => !progressOf(ex.id).completed)
    if (!next) {
      progress.value.status = 'completed'
      progress.value.phase = 'finished'
      progress.value.timer = idleTimer()
      await persistProgress()
      return true
    }
    progress.value.currentExerciseId = next.id
    progress.value.phase = 'ready'
    progress.value.timer = idleTimer()
    await persistProgress()
    return false
  }

  /** 清空当天进度：所有组数与动作状态恢复初始 */
  async function reset(): Promise<void> {
    progress.value = createEmptyProgress(dateKey.value, defaultPlanId.value)
    const idx = allProgress.value.findIndex(
      (p) => p.date === progress.value.date && p.planId === progress.value.planId
    )
    if (idx >= 0) allProgress.value[idx] = progress.value
    else allProgress.value.push(progress.value)
    await saveAllProgress(allProgress.value)
  }

  // ---- 计划管理（保持不变） ----
  function getPlanById(id: string): WorkoutPlan | null {
    return plans.value.find((p) => p.id === id) ?? null
  }

  function planStats(plan: WorkoutPlan): { days: number; exercises: number } {
    const activeDays = plan.days.filter((d) => (d.exercises?.length ?? 0) > 0)
    return {
      days: activeDays.length,
      exercises: activeDays.reduce((sum, d) => sum + d.exercises.length, 0)
    }
  }

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
    syncActiveProgress()
  }

  async function savePlan(
    input: { id?: string; name: string; days: WorkoutDay[]; setDefault: boolean }
  ): Promise<string> {
    const nowTs = Date.now()
    let planId = input.id

    if (planId && getPlanById(planId)) {
      const old = getPlanById(planId)!
      const oldIds = new Set<string>()
      old.days.forEach((d) => d.exercises.forEach((ex) => oldIds.add(ex.id)))
      const newIds = new Set<string>()
      input.days.forEach((d) => d.exercises.forEach((ex) => newIds.add(ex.id)))
      const removedIds = [...oldIds].filter((id) => !newIds.has(id))
      if (removedIds.length > 0) {
        allProgress.value.forEach((p) => {
          for (const id of removedIds) delete p.exerciseProgress[id]
          if (p.currentExerciseId && removedIds.includes(p.currentExerciseId)) {
            p.currentExerciseId = ''
          }
        })
        await saveAllProgress(allProgress.value)
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
      planId = generateId('plan')
      plans.value.push({
        id: planId,
        name: input.name,
        isDefault: false,
        createdAt: nowTs,
        updatedAt: nowTs,
        days: JSON.parse(JSON.stringify(input.days)) as WorkoutDay[]
      })
    }

    if (input.setDefault) {
      plans.value.forEach((p) => (p.isDefault = p.id === planId))
      defaultPlanId.value = planId!
      await saveDefaultPlanId(planId!)
    }
    await savePlans(plans.value)
    if (input.setDefault) syncActiveProgress()
    return planId!
  }

  async function duplicatePlan(id: string): Promise<void> {
    const source = getPlanById(id)
    if (!source) return
    const nowTs = Date.now()
    const newDays: WorkoutDay[] = JSON.parse(JSON.stringify(source.days))
    newDays.forEach((d) => d.exercises.forEach((ex) => (ex.id = generateId('ex'))))
    plans.value.push({
      id: generateId('plan'),
      name: `${source.name}（副本）`,
      isDefault: false,
      createdAt: nowTs,
      updatedAt: nowTs,
      days: newDays
    })
    await savePlans(plans.value)
  }

  async function deletePlan(id: string): Promise<{ ok: boolean; reason?: string }> {
    if (plans.value.length <= 1) return { ok: false, reason: '至少需要保留一套训练计划' }
    const target = getPlanById(id)
    if (!target) return { ok: false, reason: '计划不存在' }

    const wasDefault = target.isDefault || defaultPlanId.value === id
    plans.value = plans.value.filter((p) => p.id !== id)
    allProgress.value = allProgress.value.filter((p) => p.planId !== id)
    await saveAllProgress(allProgress.value)

    if (wasDefault) {
      const next = plans.value[0]
      plans.value.forEach((p) => (p.isDefault = p.id === next.id))
      defaultPlanId.value = next.id
      await saveDefaultPlanId(next.id)
    }
    await savePlans(plans.value)
    syncActiveProgress()
    return { ok: true }
  }

  function newExerciseId(): string {
    return generateId('ex')
  }

  // ---- 生命周期 ----
  async function init(): Promise<void> {
    const today = getDateKey()
    dateKey.value = today
    now.value = new Date()

    const loadedPlans = await loadPlans()
    const storedDefaultId = await loadDefaultPlanId()
    plans.value = loadedPlans

    const validDefault =
      loadedPlans.find((p) => p.id === storedDefaultId) ??
      loadedPlans.find((p) => p.isDefault) ??
      loadedPlans[0]
    defaultPlanId.value = validDefault?.id ?? ''

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

    const all = await loadAllProgress()
    allProgress.value = all.filter((p) => p.date === today)
    await saveAllProgress(allProgress.value)

    syncActiveProgress()
    isReady.value = true
  }

  /** 从后台恢复：跨天则清理并回到新的一天；同一天则校准计时 */
  async function refreshToday(): Promise<boolean> {
    const today = getDateKey()
    const dateChanged = today !== dateKey.value
    if (dateChanged) {
      dateKey.value = today
      allProgress.value = allProgress.value.filter((p) => p.date === today)
      await saveAllProgress(allProgress.value)
      syncActiveProgress()
    } else {
      // 锁屏 / 后台恢复：按结束时间戳校准正在运行的计时
      const t = progress.value.timer
      if (t.status === 'running' && t.endAt != null && t.endAt <= Date.now()) {
        progress.value.timer = {
          ...t,
          status: remainingSeconds(t) <= 0 ? 'finished' : t.status,
          endAt: remainingSeconds(t) <= 0 ? null : t.endAt,
          remaining: remainingSeconds(t)
        }
        await persistProgress()
      }
    }
    now.value = new Date()
    return dateChanged
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
    resolvedExercises,
    total,
    dateLabel,
    weekdayLabel,
    planName,
    completedCount,
    isCompleted,
    currentExercise,
    currentIndex,
    currentStep,
    currentPhase,
    currentSet,
    currentSetsDone,
    isExerciseCompleted,
    progressOf,
    // 计时状态
    timer,
    timerStatus,
    timerKind,
    timerRemaining,
    isTimerRunning,
    timerEndAt,
    tickTimer,
    // 训练执行
    canGoNext,
    isLastExercise,
    nextButtonText,
    start,
    completeSet,
    previous,
    startWorkTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    onCountdownFinish,
    skipRest,
    nextExercise,
    reset,
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
    // 生命周期
    init,
    refreshToday
  }
})
