<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, RotateCcw } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { useCountdown } from '@/composables/useCountdown'
import { formatAmount } from '@/utils/exercise'
import ProgressIndicator from '@/components/ProgressIndicator.vue'

const store = useWorkoutStore()
const router = useRouter()

const ex = computed(() => store.currentExercise)
const isTimerType = computed(() => ex.value?.type === 'timer')
const finished = computed(() => store.timerStatus === 'finished')

/** 倒计时驱动：基于时间戳，到期只通知，不自动完成组 */
useCountdown({
  isRunning: () => store.isTimerRunning(),
  endAt: () => store.timerEndAt(),
  tick: () => store.tickTimer(),
  onFinish: () => {
    void store.onCountdownFinish()
  }
})

const seconds = computed(() => store.timerRemaining)
/** 当前组序号：已完成组数 + 1；全部完成时等于总组数 */
const currentSet = computed(() =>
  ex.value ? Math.min(store.currentCompletedSets + 1, ex.value.sets) : 0
)
const timerPercent = computed(() => {
  const d = store.timer.duration
  return d > 0 ? Math.min(100, Math.round((seconds.value / d) * 100)) : 0
})

function formatClock(value: number): string {
  const s = Math.max(0, Math.floor(value))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 组数方块状态：done / current / todo */
function setState(index: number): 'done' | 'current' | 'todo' {
  if (index < store.currentCompletedSets) return 'done'
  if (index === store.currentCompletedSets && !store.canGoNext) return 'current'
  return 'todo'
}

/** 完成本组可用性：计时训练必须计时结束后才可确认 */
const canCompleteSet = computed(() => {
  if (!ex.value || store.resting || store.canGoNext) return false
  return isTimerType.value ? finished.value : true
})

const timerLabel = computed(() => {
  if (store.timerStatus === 'running') return '暂停计时'
  if (store.timerStatus === 'paused') return '继续计时'
  if (store.timerStatus === 'finished') return '重新计时'
  return '开始计时'
})

const restState = computed(() => {
  if (store.timerStatus === 'running') return '休息中'
  if (store.timerStatus === 'paused') return '已暂停'
  return '休息结束'
})

const restLabel = computed(() => {
  if (store.timerStatus === 'running') return '暂停'
  if (store.timerStatus === 'paused') return '继续'
  return '重新计时'
})

async function handleTimerPrimary() {
  if (store.timerStatus === 'idle' || store.timerStatus === 'finished') {
    await store.startWorkTimer()
  } else if (store.timerStatus === 'running') {
    await store.pauseTimer()
  } else {
    await store.resumeTimer()
  }
}

async function handleRestToggle() {
  if (store.timerStatus === 'running') await store.pauseTimer()
  else if (store.timerStatus === 'paused') await store.resumeTimer()
  else await store.resetTimer()
}

async function handleNext() {
  const done = await store.nextExercise()
  if (done) router.push('/complete')
}
</script>

<template>
  <main class="page">
    <header class="topbar">
      <button class="icon-btn" aria-label="返回首页" @click="router.push('/')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="topbar-title">{{ store.title }}</h1>
    </header>

    <!-- 顶部整体进度 -->
    <ProgressIndicator :current="store.completedCount" :total="store.total" label="整体进度" />

    <Transition name="item" mode="out-in">
      <div v-if="ex" :key="ex.id" class="stage">
        <!-- 当前动作 -->
        <section class="card exercise-card">
          <p class="eyebrow">{{ isTimerType ? '计时训练' : '次数训练' }}</p>
          <h2 class="name">{{ ex.name }}</h2>
          <p class="amount">
            {{ formatAmount(ex) }}<span v-if="ex.restSeconds > 0" class="amount-rest"
              >· 休息 {{ ex.restSeconds }} 秒</span
            >
          </p>
          <p v-if="ex.note" class="note">{{ ex.note }}</p>
        </section>

        <!-- 组数进度：独立盒子，与动作卡片分开 -->
        <section class="card sets-card">
          <div class="sets-head">
            <span class="sets-label">组数进度</span>
            <span class="sets-current">第 {{ currentSet }} 组 / 共 {{ ex.sets }} 组</span>
          </div>
          <div class="sets-dots">
            <span v-for="i in ex.sets" :key="i" class="set" :class="`is-${setState(i - 1)}`">
              <Check v-if="setState(i - 1) === 'done'" :size="15" :stroke-width="3.5" />
              <template v-else>{{ i }}</template>
            </span>
          </div>
        </section>

        <!-- 组间休息 -->
        <section v-if="store.resting" class="card panel">
          <div class="panel-head">
            <span class="panel-label">组间休息</span>
            <span class="panel-state">{{ restState }}</span>
          </div>
          <div class="clock" :class="{ 'is-done': finished }">{{ formatClock(seconds) }}</div>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" @click="handleRestToggle">{{ restLabel }}</button>
            <button class="icon-btn" aria-label="重新计时" @click="store.resetTimer">
              <RotateCcw :size="16" />
            </button>
            <button class="btn btn-ghost btn-sm" @click="store.skipRest">跳过</button>
          </div>
        </section>

        <!-- 本组计时 -->
        <section v-else-if="isTimerType && !store.canGoNext" class="card panel">
          <div class="clock" :class="{ 'is-done': finished }">{{ formatClock(seconds) }}</div>
          <div class="track">
            <div class="track-fill" :style="{ width: `${timerPercent}%` }"></div>
          </div>
          <p v-if="finished" class="panel-hint">时间到，可完成本组</p>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" @click="handleTimerPrimary">{{ timerLabel }}</button>
            <button class="btn btn-ghost btn-sm" @click="store.resetTimer">重置</button>
          </div>
        </section>
      </div>
    </Transition>

    <!-- 底部只保留一个主操作：未完成本组时是「完成本组」，全组完成后是「下一项」 -->
    <footer class="footer">
      <template v-if="!store.resting">
        <button v-if="store.canGoNext" class="btn btn-primary" @click="handleNext">
          {{ store.nextButtonText }}
        </button>
        <button v-else class="btn btn-primary" :disabled="!canCompleteSet" @click="store.completeSet">
          完成本组
        </button>
        <button v-if="store.completedCount > 0" class="link" @click="store.previous">撤销上一组</button>
      </template>
    </footer>
  </main>
</template>

<style scoped lang="less">
/* 动作卡 / 组数卡 / 计时卡三块独立，紧接顶部整体进度向下排布 */
.stage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;

  > * {
    flex-shrink: 0;
  }
}

.exercise-card {
  padding: 18px;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.name {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.35;
}

.amount {
  margin: 6px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.amount-rest {
  margin-left: 6px;
  font-weight: 500;
  color: var(--text-muted);
}

.note {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-soft);
}

/* 组数进度 */
.sets-card {
  padding: 14px 18px 16px;
}

.sets-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.sets-label {
  font-size: 13px;
  font-weight: 700;
}

.sets-current {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.sets-dots {
  display: flex;
  gap: 8px;
}

.set {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text-muted);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;

  &.is-done {
    background: var(--success-soft);
    color: var(--success);
    border-color: transparent;
  }

  &.is-current {
    background: var(--primary);
    color: #fff;
    border-color: transparent;
  }
}

/* 计时 / 休息面板 */
.panel {
  padding: 16px 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.panel-label {
  font-size: 13px;
  font-weight: 700;
}

.panel-state {
  font-size: 12px;
  color: var(--text-muted);
}

.clock {
  text-align: center;
  font-size: 44px;
  font-weight: 800;
  letter-spacing: 1px;
  line-height: 1.2;
  color: var(--primary);
  font-variant-numeric: tabular-nums;

  &.is-done {
    color: var(--success);
  }
}

.panel-hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--success);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;

  .btn {
    flex: 1;
  }

  .icon-btn {
    flex: 0 0 38px;
  }
}
</style>
