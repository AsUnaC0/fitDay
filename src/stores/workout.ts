import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  ResolvedExercise,
  WorkoutDay,
  WorkoutPlan,
  WorkoutProgress,
  ExerciseProgress,
  TimerKind,
  TimerState
} from '@/types'
import {
  formatChineseDate,
  getDateKey,
  getWeekday,
  weekdayLabel as weekdayText
} from '@/utils/date'
import { normalizeExercise } from '@/utils/exercise'
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
    date,
    planId,
    currentExerciseId: '',
    exerciseProgress: {},
    timer: idleTimer()
  }
}

export const useWorkoutStore = defineStore('workout', () => {
  /** 异步读取缓存完成前为 false，避免页面闪烁 */
  const isReady = ref(false)
  const now = ref(new Date())
  const dateKey = ref(getDateKey(now.value))

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

  const todayPlan = computed<WorkoutDay | null>(
    () => defaultPlan.value?.days.find((d) => d.weekday === getWeekday(now.value)) ?? null
  )

  const title = computed(() => todayPlan.value?.title ?? '今日无训练计划')
  const notes = computed(() => todayPlan.value?.notes ?? '')
  const isRestDay = computed(
    () => todayPlan.value?.isRestDay ?? (todayPlan.value?.exercises.length ?? 0) === 0
  )

  /** 今日动作：统一规范化，视图只消费这一份结构 */
  const exercises = computed<ResolvedExercise[]>(() =>
    (todayPlan.value?.exercises ?? []).map(normalizeExercise)
  )
  const total = computed(() => exercises.value.length)

  const dateLabel = computed(() => formatChineseDate(now.value))
  const weekdayLabel = computed(() => weekdayText(getWeekday(now.value)))
  const planName = computed(() => defaultPlan.value?.name ?? '')

  // ---- 当前动作 / 当前组 ----
  const currentExercise = computed<ResolvedExercise | null>(() => {
    const id = progress.value.currentExerciseId
    return exercises.value.find((ex) => ex.id === id) ?? null
  })
  const currentIndex = computed(() => {
    const current = currentExercise.value
    return current ? exercises.value.findIndex((ex) => ex.id === current.id) : -1
  })

  /** 某个动作的进度（不存在时返回安全默认值） */
  function progressOf(exerciseId: string): ExerciseProgress {
    return progress.value.exerciseProgress[exerciseId] ?? { completedSets: 0, completed: false }
  }

  const currentCompletedSets = computed(() => {
    const ex = currentExercise.value
    return ex ? progressOf(ex.id).completedSets : 0
  })

  const completedCount = computed(
    () => exercises.value.filter((ex) => progressOf(ex.id).completed).length
  )
  const isCompleted = computed(
    () => !isRestDay.value && total.value > 0 && completedCount.value >= total.value
  )
  const isExerciseCompleted = (id: string): boolean => progressOf(id).completed

  // ---- 计时状态 ----
  /** 时钟 ref：由 tick 驱动更新，让倒计时的 computed 每秒重新计算 */
  const clock = ref(Date.now())
  const timer = computed<TimerState>(() => progress.value.timer)
  const timerStatus = computed(() => progress.value.timer.status)
  const timerRemaining = computed(() => remainingSeconds(progress.value.timer, clock.value))
  /** 组间休息：由计时器用途直接派生，无需额外的阶段字段 */
  const resting = computed(() => progress.value.timer.kind === 'rest')

  function isTimerRunning(): boolean {
    return progress.value.timer.status === 'running'
  }
  function timerEndAt(): number | null {
    return progress.value.timer.endAt
  }
  /** 刷新并返回剩余秒数，到期时改为 finished（不推进进度） */
  function tickTimer(): number {
    clock.value = Date.now()
    if (progress.value.timer.status !== 'running') {
      return remainingSeconds(progress.value.timer, clock.value)
    }
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
    const list = exercises.value
    if (list.length === 0) return
    const current = list.find((ex) => ex.id === progress.value.currentExerciseId)
    if (current && !progressOf(current.id).completed) return
    const next = list.find((ex) => !progressOf(ex.id).completed) ?? list[list.length - 1]
    progress.value.currentExerciseId = next.id
    // 定位到新动作时，计时回到初始（同时结束休息态）
    progress.value.timer = idleTimer()
  }

  /**
   * 启动 / 恢复今日训练：定位第一个未完成动作。
   * 已有进行中进度时保留当前动作（继续训练）。
   */
  async function start(): Promise<void> {
    if (isRestDay.value || total.value === 0) return
    ensureCurrentExercise()
    await persistProgress()
  }

  // ---- 训练执行：组 ----
  /**
   * 完成当前组。次数训练与计时训练共用。
   * 计时训练只有在计时已到时（status==='finished'）才允许确认，避免跳过计时。
   * 防重复：休息中 / 本组已完成 / 动作已完成时一律忽略。
   */
  async function completeSet(): Promise<void> {
    const ex = currentExercise.value
    if (!ex || resting.value) return
    if (ex.type === 'timer' && progress.value.timer.status !== 'finished') return

    const state = progress.value.exerciseProgress[ex.id] ?? { completedSets: 0, completed: false }
    if (state.completed || state.completedSets >= ex.sets) return

    state.completedSets += 1
    state.completed = state.completedSets >= ex.sets
    progress.value.exerciseProgress[ex.id] = state

    // 本动作全部组完成 → 等待用户点"下一项"，不自动跳转
    if (!state.completed && ex.restSeconds > 0) {
      startCountdown('rest', ex.restSeconds)
    } else {
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

  /** 开始当前动作的训练计时（仅计时训练、且未完成时可用） */
  async function startWorkTimer(): Promise<void> {
    const ex = currentExercise.value
    if (!ex || ex.type !== 'timer') return
    if (progressOf(ex.id).completed) return
    startCountdown('work', ex.duration)
    await persistProgress()
  }

  /** 暂停：记录剩余秒数，停止依赖时间戳的倒计时 */
  async function pauseTimer(): Promise<void> {
    const t = progress.value.timer
    if (t.status !== 'running') return
    const nowTs = Date.now()
    const left = remainingSeconds(t, nowTs)
    clock.value = nowTs
    progress.value.timer = { ...t, status: 'paused', endAt: null, remaining: left }
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

  /** 重新计时（用途不变，重新开始整段时长） */
  async function resetTimer(): Promise<void> {
    const t = progress.value.timer
    if (!t.kind) return
    startCountdown(t.kind, t.duration)
    await persistProgress()
  }

  /** 倒计时到期回调：只落盘 finished 状态，绝不自动完成组或跳页 */
  async function onCountdownFinish(): Promise<void> {
    const t = progress.value.timer
    if (t.status !== 'running' || t.kind == null) return
    progress.value.timer = { ...t, status: 'finished', endAt: null, remaining: 0 }
    await persistProgress()
  }

  /** 跳过组间休息：回到待开始状态（不增加已完成组数） */
  async function skipRest(): Promise<void> {
    if (!resting.value) return
    progress.value.timer = idleTimer()
    await persistProgress()
  }

  // ---- 训练执行：动作 / 完成 ----
  /** 是否允许进入下一项：仅当前动作全组完成时解锁 */
  const canGoNext = computed(() => {
    const ex = currentExercise.value
    return !!ex && progressOf(ex.id).completed
  })

  const nextButtonText = computed(() =>
    currentIndex.value >= 0 && currentIndex.value === total.value - 1 ? '完成今日训练' : '下一项'
  )

  /**
   * 进入下一个动作。仅在 canGoNext 时生效。
   * 最后一个动作完成后标记今日完成，由视图跳转到完成页。
   */
  async function nextExercise(): Promise<boolean> {
    if (!canGoNext.value) return false
    const next = exercises.value.find((ex) => !progressOf(ex.id).completed)
    if (!next) {
      progress.value.timer = idleTimer()
      await persistProgress()
      return true
    }
    progress.value.currentExerciseId = next.id
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

  // ---- 计划管理 ----
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
    if (!plans.value.some((p) => p.id === id)) return
    plans.value.forEach((p) => (p.isDefault = p.id === id))
    defaultPlanId.value = id
    await savePlans(plans.value)
    await saveDefaultPlanId(id)
    syncActiveProgress()
  }

  async function savePlan(input: {
    id?: string
    name: string
    days: WorkoutDay[]
    setDefault: boolean
  }): Promise<string> {
    const days = JSON.parse(JSON.stringify(input.days)) as WorkoutDay[]
    const existing = input.id ? getPlanById(input.id) : null
    let planId: string
    let progressChanged = false

    if (existing) {
      planId = existing.id
      // 被移除的动作要同时清理历史进度，避免残留脏数据
      const oldIds = new Set<string>()
      existing.days.forEach((d) => d.exercises.forEach((ex) => oldIds.add(ex.id)))
      const newIds = new Set<string>()
      days.forEach((d) => d.exercises.forEach((ex) => newIds.add(ex.id)))
      const removedIds = [...oldIds].filter((id) => !newIds.has(id))

      plans.value = plans.value.map((p) => (p.id === planId ? { ...p, name: input.name, days } : p))

      if (removedIds.length > 0) {
        allProgress.value.forEach((p) => {
          removedIds.forEach((id) => delete p.exerciseProgress[id])
          if (removedIds.includes(p.currentExerciseId)) p.currentExerciseId = ''
        })
        await saveAllProgress(allProgress.value)
        progressChanged = true
      }
    } else {
      planId = generateId('plan')
      plans.value.push({ id: planId, name: input.name, isDefault: false, days })
    }

    if (input.setDefault) {
      plans.value.forEach((p) => (p.isDefault = p.id === planId))
      defaultPlanId.value = planId
      await saveDefaultPlanId(planId)
      progressChanged = true
    }
    await savePlans(plans.value)
    if (progressChanged) syncActiveProgress()
    return planId
  }

  async function duplicatePlan(id: string): Promise<void> {
    const source = getPlanById(id)
    if (!source) return
    const days = JSON.parse(JSON.stringify(source.days)) as WorkoutDay[]
    days.forEach((d) => d.exercises.forEach((ex) => (ex.id = generateId('ex'))))
    plans.value.push({
      id: generateId('plan'),
      name: `${source.name}（副本）`,
      isDefault: false,
      days
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
    // 只保留今天的记录，旧日期缓存不再参与任何逻辑
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
          status: 'finished',
          endAt: null,
          remaining: 0
        }
        await persistProgress()
      }
    }
    now.value = new Date()
    return dateChanged
  }

  return {
    // 状态
    isReady,
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
    isExerciseCompleted,
    // 当前动作
    currentExercise,
    currentCompletedSets,
    // 计时
    timer,
    timerStatus,
    timerRemaining,
    resting,
    isTimerRunning,
    timerEndAt,
    tickTimer,
    // 训练执行
    canGoNext,
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
