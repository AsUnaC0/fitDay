<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import ProgressIndicator from '@/components/ProgressIndicator.vue'

const store = useWorkoutStore()
const router = useRouter()

const isLast = computed(() => store.total - store.completedCount <= 1)
const buttonText = computed(() => (isLast.value ? '完成，查看结果' : '完成，下一项'))

async function handleComplete() {
  await store.completeCurrent()
  if (store.isCompleted) router.push('/complete')
}

async function handlePrevious() {
  await store.previous()
}

function handleBack() {
  router.push('/')
}
</script>

<template>
  <main class="page">
    <header class="train-header">
      <button class="back-btn" aria-label="返回首页" @click="handleBack">
        <ArrowLeft :size="20" />
      </button>
      <div class="header-text">
        <span class="header-label">今日训练</span>
        <span class="header-title">{{ store.title }}</span>
      </div>
    </header>

    <div class="progress-wrap">
      <ProgressIndicator :current="store.currentStep" :total="store.total" />
    </div>

    <Transition name="item" mode="out-in">
      <section v-if="store.currentExercise" :key="store.currentExercise.id" class="exercise-stage">
        <div class="step-tag">第 {{ store.currentStep }} 个动作</div>

        <h1 class="exercise-name">{{ store.currentExercise.name }}</h1>

        <div class="metrics">
          <div class="metric">
            <span class="metric-value">{{ store.currentExercise.sets ?? '—' }}</span>
            <span class="metric-unit">组</span>
          </div>
          <span class="metric-times">×</span>
          <div class="metric">
            <span class="metric-value metric-value--reps">{{ store.currentExercise.reps ?? '—' }}</span>
            <span class="metric-unit">次 / 时长</span>
          </div>
        </div>

        <div v-if="store.currentExercise.note" class="exercise-note">
          {{ store.currentExercise.note }}
        </div>
      </section>
    </Transition>

    <div class="train-footer">
      <button class="btn btn-primary" @click="handleComplete">
        <Check :size="20" :stroke-width="2.6" />
        {{ buttonText }}
      </button>

      <button v-if="store.completedCount > 0" class="btn btn-ghost prev-btn" @click="handlePrevious">
        <ArrowLeft :size="16" />
        上一个任务
      </button>

      <button class="text-back" @click="handleBack">返回首页</button>
    </div>
  </main>
</template>

<style scoped lang="less">
.train-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
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

.progress-wrap {
  padding: 0 2px;
}

.exercise-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 8px;
}

.step-tag {
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 26px;
}

.exercise-name {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: 0.5px;
  color: var(--color-text);
}

.metrics {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 22px;
  margin-top: 36px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 72px;
}

.metric-value {
  font-size: 44px;
  line-height: 1;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-accent), var(--color-primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  &--reps {
    font-size: 30px;
    padding: 0 6px;
    white-space: nowrap;
  }
}

.metric-unit {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.metric-times {
  font-size: 26px;
  color: var(--color-text-muted);
  padding-bottom: 24px;
}

.exercise-note {
  margin-top: 32px;
  padding: 12px 18px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.train-footer {
  margin-top: auto;
  padding-top: 20px;
}

.prev-btn {
  min-height: 48px;
  margin-top: 12px;
  font-size: 14px;
}

.text-back {
  display: block;
  margin: 16px auto 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
