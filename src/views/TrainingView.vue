<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer
} from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { useCountdown } from '@/composables/useCountdown'
import ProgressIndicator from '@/components/ProgressIndicator.vue'

const store = useWorkoutStore()
const router = useRouter()

const ex = computed(() => store.currentExercise)
const isTimerType = computed(() => ex.value?.type === 'timer')
const isResting = computed(() => store.currentPhase === 'resting')

/** 倒计时驱动：基于时间戳，到期只通知，不自动完成组 */
useCountdown({
  isRunning: () => store.isTimerRunning(),
  endAt: () => store.timerEndAt(),
  tick: () => store.tickTimer(),
  onFinish: () => {
    void store.onCountdownFinish()
  }
})

/** 用 store 的剩余秒数驱动显示；倒计时归零视觉提示由 status==='finished' 体现 */
const displaySeconds = computed(() => store.timerRemaining)
const timerPercent = computed(() => {
  const t = store.timer
  if (!t || t.duration <= 0) return 0
  return Math.min(100, Math.round((displaySeconds.value / t.duration) * 100))
})

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

async function handleCompleteSet() {
  await store.completeSet()
}

async function handleNext() {
  const finished = await store.nextExercise()
  if (finished) router.push('/complete')
}

function handleBack() {
  router.push('/')
}

/** 计时训练：根据当前计时状态切换开始/暂停/继续/重置 */
async function handleTimerPrimary() {
  const status = store.timerStatus
  if (status === 'idle' || status === 'finished') await store.startWorkTimer()
  else if (status === 'running') await store.pauseTimer()
  else if (status === 'paused') await store.resumeTimer()
}

/** 休息计时的暂停 / 继续切换 */
async function handleRestToggle() {
  const status = store.timerStatus
  if (status === 'running') await store.pauseTimer()
  else if (status === 'paused') await store.resumeTimer()
  else await store.resetTimer()
}

const timerPrimaryLabel = computed(() => {
  const status = store.timerStatus
  if (status === 'running') return '暂停计时'
  if (status === 'paused') return '继续计时'
  if (status === 'finished') return '重新计时'
  return '开始计时'
})

/** 完成本组按钮可用性 */
const canCompleteSet = computed(() => {
  if (!ex.value || isResting.value) return false
  if (store.currentSetsDone) return false
  if (isTimerType.value) return store.timerStatus === 'finished'
  return true
})

/** 组数方块状态：done / current / todo */
function setStatus(index: number): 'done' | 'current' | 'todo' {
  const state = store.progressOf(ex.value!.id)
  if (index < state.completedSets) return 'done'
  if (index === state.completedSets && !state.completed) return 'current'
  return 'todo'
}
</script>

<template>
  <main class="page">
    <!-- 顶部：主题 + 进度 -->
    <header class="train-header">
      <button class="back-btn" aria-label="返回首页" @click="handleBack">
        <ArrowLeft :size="20" />
      </button>
      <div class="header-text">
        <span class="header-label">今日训练</span>
        <span class="header-title">{{ store.title }}</span>
      </div>
      <span class="exercise-count">{{ store.currentStep }} / {{ store.total }} 项</span>
    </header>

    <div class="progress-wrap">
      <ProgressIndicator :current="store.completedCount" :total="store.total" label="整体进度" />
    </div>

    <Transition name="item" mode="out-in">
      <section v-if="ex" :key="ex.id" class="stage">
        <!-- 当前动作卡片 -->
        <div class="exercise-card">
          <div class="card-top">
            <span class="step-tag">第 {{ store.currentStep }} 个动作</span>
            <span class="type-tag" :class="{ 'type-tag--timer': ex.type === 'timer' }">
              {{ ex.type === 'timer' ? '计时训练' : '次数训练' }}
            </span>
          </div>
          <h1 class="exercise-name">{{ ex.name }}</h1>
          <div class="metrics">
            <div class="metric">
              <span class="metric-value">{{ ex.sets }}</span>
              <span class="metric-unit">组</span>
            </div>
            <span class="metric-times">×</span>
            <div class="metric">
              <span class="metric-value metric-value--main">
                {{ ex.type === 'timer' ? `${ex.duration}秒` : ex.reps }}
              </span>
              <span class="metric-unit">{{ ex.type === 'timer' ? '每组时长' : '每组次数' }}</span>
            </div>
          </div>
          <div v-if="ex.note" class="exercise-note">{{ ex.note }}</div>
        </div>

        <!-- 组数进度 -->
        <div class="sets-card">
          <div class="sets-head">
            <span class="sets-title">组数进度</span>
            <span class="sets-current">
              第 {{ store.currentSet }} 组 / 共 {{ ex.sets }} 组
            </span>
          </div>
          <div class="sets-grid">
            <div v-for="i in ex.sets" :key="i" class="set-box" :class="`set-box--${setStatus(i - 1)}`">
              <Check v-if="setStatus(i - 1) === 'done'" :size="18" :stroke-width="3" />
              <span v-else>{{ i }}</span>
            </div>
          </div>
        </div>

        <!-- 组间休息 -->
        <div v-if="isResting" class="rest-card">
          <div class="rest-head">
            <span class="rest-label">
              <Timer :size="16" /> 组间休息
            </span>
            <span class="rest-hint">休息不计入已完成组数</span>
          </div>
          <div class="rest-clock" :class="{ 'rest-clock--done': store.timerStatus === 'finished' }">
            {{ formatClock(displaySeconds) }}
          </div>
          <div class="rest-actions">
            <button class="btn btn-secondary rest-action" @click="handleRestToggle">
              <Play v-if="store.timerStatus !== 'running'" :size="16" />
              <Pause v-else :size="16" />
              {{ store.timerStatus === 'running' ? '暂停' : store.timerStatus === 'paused' ? '继续' : '重新计时' }}
            </button>
            <button class="btn btn-ghost rest-action" @click="store.resetTimer">
              <RotateCcw :size="16" /> 重计
            </button>
            <button class="btn btn-ghost rest-action" @click="store.skipRest">
              <SkipForward :size="16" /> 跳过
            </button>
          </div>
          <p v-if="store.timerStatus === 'finished'" class="rest-done-hint">休息结束，可进入下一组</p>
        </div>

        <!-- 计时训练操作区（非休息时） -->
        <div v-else-if="isTimerType && !store.currentSetsDone" class="timer-card">
          <div class="timer-head">
            <span class="timer-label">
              <Timer :size="16" /> 本组计时
            </span>
            <span class="timer-state">
              {{
                store.timerStatus === 'finished'
                  ? '时间到，请确认完成'
                  : store.timerStatus === 'running'
                    ? '计时中'
                    : store.timerStatus === 'paused'
                      ? '已暂停'
                      : '未开始'
              }}
            </span>
          </div>
          <div class="timer-clock" :class="{ 'timer-clock--done': store.timerStatus === 'finished' }">
            {{ formatClock(displaySeconds) }}
          </div>
          <div class="timer-track">
            <div class="timer-fill" :style="{ width: `${timerPercent}%` }"></div>
          </div>
          <div class="timer-actions">
            <button class="btn btn-secondary" @click="handleTimerPrimary">
              <Play v-if="store.timerStatus !== 'running'" :size="18" />
              <Pause v-else :size="18" />
              {{ timerPrimaryLabel }}
            </button>
            <button class="btn btn-ghost" @click="store.resetTimer">
              <RotateCcw :size="17" /> 重置
            </button>
          </div>
        </div>

        <!-- 全部组完成提示 -->
        <div v-if="store.currentSetsDone" class="all-done-card">
          <CircleCheck :size="22" />
          <span>本动作全部 {{ ex.sets }} 组已完成，进入下一项</span>
        </div>
      </section>
    </Transition>

    <!-- 底部固定操作 -->
    <div class="train-footer">
      <button v-if="!isResting" class="btn btn-secondary complete-set-btn" :disabled="!canCompleteSet"
        @click="handleCompleteSet">
        <Check :size="19" :stroke-width="2.6" />
        完成本组（{{ store.currentSet }}/{{ ex?.sets ?? 0 }}）
      </button>
      <button class="btn btn-primary next-btn" :disabled="!store.canGoNext" @click="handleNext">
        {{ store.nextButtonText }}
      </button>
      <button v-if="store.completedCount > 0" class="text-undo" @click="store.previous">
        撤销上一组
      </button>
    </div>
  </main>
</template>

<style scoped lang="less">
.train-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.back-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.header-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.header-title {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.exercise-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  flex-shrink: 0;
}

.progress-wrap {
  padding: 0 2px;
}

.stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
}

.exercise-card {
  border-radius: 20px;
  padding: 22px 20px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.step-tag {
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.type-tag {
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--color-success-soft);
  color: var(--color-success);
  font-size: 11px;
  font-weight: 700;

  &--timer {
    background: #fff2e6;
    color: #d9862b;
  }
}

.exercise-name {
  margin: 16px 0 0;
  font-size: 27px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--color-text);
}

.metrics {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  margin-top: 24px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
}

.metric-value {
  font-size: 38px;
  line-height: 1;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-accent), var(--color-primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  &--main {
    font-size: 26px;
    padding: 0 4px;
    white-space: nowrap;
  }
}

.metric-unit {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.metric-times {
  font-size: 22px;
  color: var(--color-text-muted);
  padding-bottom: 20px;
}

.exercise-note {
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--color-bg);
  font-size: 13px;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.sets-card {
  border-radius: 20px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  position: relative;
}

.sets-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sets-title {
  font-size: 14px;
  font-weight: 700;
}

.sets-current {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}

.sets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.set-box {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;

  &--done {
    background: var(--color-success-soft);
    color: var(--color-success);
    border-color: transparent;
  }

  &--current {
    background: var(--color-primary);
    color: #fff;
    border-color: transparent;
    box-shadow: var(--shadow-btn);
    transform: scale(1.06);
  }

  &--todo {
    background: var(--color-bg);
    color: var(--color-text-muted);
  }
}

.timer-card,
.rest-card {
  border-radius: 20px;
  padding: 20px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.timer-head,
.rest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.timer-label,
.rest-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
}

.timer-state,
.rest-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.timer-clock,
.rest-clock {
  text-align: center;
  font-size: 54px;
  font-weight: 800;
  letter-spacing: 2px;
  margin: 14px 0 10px;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;

  &--done {
    color: var(--color-success);
  }
}

.rest-clock {
  font-size: 44px;
}

.timer-track {
  height: 8px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-primary));
  transition: width 0.25s linear;
}

.timer-actions,
.rest-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;

  .btn {
    min-height: 46px;
    font-size: 14px;
  }
}

.rest-action {
  flex: 1;
  padding: 0 8px;
}

.rest-done-hint {
  margin: 14px 0 0;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-success);
}

.all-done-card {
  border-radius: 16px;
  padding: 18px;
  background: var(--color-success-soft);
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
}

.train-footer {
  margin-top: auto;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.complete-set-btn {
  min-height: 50px;
}

.next-btn {
  min-height: 56px;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.text-undo {
  display: block;
  margin: 4px auto 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
