<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, RotateCcw } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { useCountdown } from '@/composables/useCountdown'
import { formatAmount } from '@/utils/exercise'

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
const percent = computed(() =>
  store.total ? Math.round((store.completedCount / store.total) * 100) : 0
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
      <span class="topbar-meta">{{ store.completedCount }}/{{ store.total }}</span>
    </header>

    <div class="track">
      <div class="track-fill" :style="{ width: `${percent}%` }"></div>
    </div>

    <Transition name="item" mode="out-in">
      <section v-if="ex" :key="ex.id" class="card stage">
        <p class="eyebrow">{{ isTimerType ? '计时训练' : '次数训练' }}</p>
        <h2 class="name">{{ ex.name }}</h2>
        <p class="amount">{{ formatAmount(ex) }}</p>
        <p v-if="ex.note" class="note">{{ ex.note }}</p>

        <!-- 组数进度：方块本身即状态，不再重复文字说明 -->
        <div class="sets">
          <span class="sets-label">组数</span>
          <div class="sets-dots">
            <span v-for="i in ex.sets" :key="i" class="set" :class="`is-${setState(i - 1)}`">
              <Check v-if="setState(i - 1) === 'done'" :size="15" :stroke-width="3.5" />
              <template v-else>{{ i }}</template>
            </span>
          </div>
        </div>

        <!-- 组间休息 -->
        <div v-if="store.resting" class="panel">
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
        </div>

        <!-- 本组计时 -->
        <div v-else-if="isTimerType && !store.canGoNext" class="panel">
          <div class="clock" :class="{ 'is-done': finished }">{{ formatClock(seconds) }}</div>
          <div class="track">
            <div class="track-fill" :style="{ width: `${timerPercent}%` }"></div>
          </div>
          <p v-if="finished" class="panel-hint">时间到，可完成本组</p>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" @click="handleTimerPrimary">{{ timerLabel }}</button>
            <button class="btn btn-ghost btn-sm" @click="store.resetTimer">重置</button>
          </div>
        </div>
      </section>
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
/* 单屏内当前动作卡片垂直居中，与底部操作区形成对称留白 */
.stage {
  margin-top: auto;
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

.note {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-soft);
}

.sets {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.sets-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
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
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
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
  font-size: 46px;
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
