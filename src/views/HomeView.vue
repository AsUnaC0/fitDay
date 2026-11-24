<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Layers,
  Moon,
  Sparkles
} from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import ExerciseItem from '@/components/ExerciseItem.vue'

const store = useWorkoutStore()
const router = useRouter()

const buttonText = computed(() => {
  if (store.isCompleted) return '查看完成结果'
  if (store.progress.status === 'in_progress' || store.completedCount > 0) return '继续训练'
  return '开始训练'
})

function handleStart() {
  if (store.isCompleted) {
    router.push('/complete')
    return
  }
  store.start()
  router.push('/training')
}
</script>

<template>
  <main class="page">
    <!-- 顶部：左侧计划按钮，右侧日期 -->
    <header class="header">
      <button class="plans-btn" aria-label="训练计划" @click="router.push('/plans')">
        <Layers :size="18" />
        <span>计划</span>
      </button>
      <div class="today-chip">
        <CalendarDays :size="15" />
        <span>{{ store.dateLabel }}</span>
      </div>
    </header>

    <!-- 休息日 -->
    <template v-if="store.isRestDay">
      <section class="rest-card">
        <div class="rest-icon">
          <Moon :size="32" :stroke-width="1.8" />
        </div>
        <h2 class="rest-title">今天是休息日</h2>
        <p class="rest-desc">{{ store.notes || '今天没有力量训练任务，记得好好休息。' }}</p>
      </section>

      <section v-if="store.exercises.length" class="card stretch-card">
        <p class="section-title">轻度拉伸 · 自愿进行</p>
        <ExerciseItem v-for="(exercise, index) in store.exercises" :key="exercise.id" :exercise="exercise"
          :index="index" :completed="false" />
        <p class="stretch-tip">拉伸内容不计入训练打卡</p>
      </section>

      <div class="rest-footer">好好休息，明天继续</div>
    </template>

    <!-- 无训练计划（空状态） -->
    <template v-else-if="store.total === 0">
      <section class="card empty-card">
        <div class="empty-icon">
          <Sparkles :size="34" :stroke-width="1.6" />
        </div>
        <h2>今日暂无训练计划</h2>
        <p>去计划列表创建一套训练计划吧。</p>
        <button class="btn btn-primary empty-action" @click="router.push('/plans')">
          <Layers :size="17" /> 前往计划列表
        </button>
      </section>
    </template>

    <!-- 普通训练日 -->
    <template v-else>
      <section class="hero-card">
        <div class="hero-top">
          <span class="weekday">{{ store.weekdayLabel }}</span>
          <span v-if="store.isCompleted" class="done-badge">
            <CircleCheck :size="14" /> 已完成
          </span>
        </div>
        <h2 class="hero-title">{{ store.title }}</h2>
        <p class="hero-date">{{ store.dateLabel }} · {{ store.planName }}</p>
        <div v-if="store.notes" class="hero-note">{{ store.notes }}</div>
      </section>

      <section class="card list-card">
        <div class="list-header">
          <p class="section-title">今日动作</p>
          <span class="list-count">{{ store.completedCount }} / {{ store.total }} 已完成</span>
        </div>
        <TransitionGroup name="item">
          <ExerciseItem v-for="(exercise, index) in store.exercises" :key="exercise.id" :exercise="exercise"
            :index="index" :completed="store.isExerciseCompleted(exercise.id)" />
        </TransitionGroup>
      </section>

      <div class="home-footer">
        <button class="btn btn-primary" @click="handleStart">
          {{ buttonText }}
          <ArrowRight :size="19" />
        </button>
      </div>
    </template>
  </main>
</template>

<style scoped lang="less">
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.today-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 12px;
  white-space: nowrap;
}

.plans-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: 11px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 24px 22px;
  color: #fff;
  background: linear-gradient(135deg, #7d78f2 0%, #5b5bd6 55%, #4a49b8 100%);
  box-shadow: 0 12px 30px rgba(91, 91, 214, 0.28);

  &::after {
    content: '';
    position: absolute;
    right: -40px;
    top: -50px;
    width: 170px;
    height: 170px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.weekday {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.92;
}

.done-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  font-weight: 600;
}

.hero-title {
  position: relative;
  margin: 12px 0 6px;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.35;
}

.hero-date {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}

.hero-note {
  position: relative;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 12px;
  opacity: 0.88;
  line-height: 1.5;
}

.list-card {
  margin-top: 18px;
}

.list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.list-count {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
}

.home-footer {
  margin-top: auto;
  padding-top: 26px;
}

.rest-card {
  border-radius: 22px;
  padding: 34px 24px;
  text-align: center;
  background: linear-gradient(160deg, #ffffff, #eef3ff);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.rest-icon {
  width: 66px;
  height: 66px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.rest-title {
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 800;
}

.rest-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-soft);
}

.stretch-card {
  margin-top: 18px;
}

.stretch-tip {
  margin: 14px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

.rest-footer {
  margin-top: auto;
  padding-top: 28px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
}

.empty-card {
  margin-top: 30px;
  text-align: center;
  padding: 40px 24px;
}

.empty-icon {
  color: var(--color-primary);
  margin-bottom: 12px;
}

.empty-card h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.empty-card p {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-soft);
}

.empty-action {
  width: auto;
  padding: 0 24px;
  min-height: 46px;
}
</style>
