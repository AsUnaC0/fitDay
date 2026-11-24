<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CircleCheck, RotateCcw } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'

const store = useWorkoutStore()
const router = useRouter()

function handleHome() {
  router.push('/')
}

async function handleReset() {
  await store.reset()
  router.push('/')
}
</script>

<template>
  <main class="page page--center">
    <section class="complete-panel">
      <div class="success-icon">
        <CircleCheck :size="56" :stroke-width="1.8" />
      </div>

      <h1 class="complete-title">今日锻炼已完成！</h1>
      <p class="complete-desc">今天的训练任务全部完成，辛苦了！</p>

      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label">今日训练</span>
          <span class="summary-value">{{ store.title }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">完成动作</span>
          <span class="summary-value summary-value--accent">{{ store.completedCount }} 个</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">完成日期</span>
          <span class="summary-value">{{ store.dateLabel }}</span>
        </div>
      </div>
    </section>

    <div class="complete-footer">
      <button class="btn btn-primary" @click="handleHome">
        返回首页
      </button>
      <button class="btn btn-ghost reset-btn" @click="handleReset">
        <RotateCcw :size="17" />
        重新训练
      </button>
    </div>
  </main>
</template>

<style scoped lang="less">
.complete-panel {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.success-icon {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #34c993, var(--color-success));
  box-shadow: 0 12px 28px rgba(31, 174, 124, 0.28);
  animation: pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes pop {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.complete-title {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 800;
}

.complete-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.summary-card {
  width: 100%;
  margin-top: 36px;
  padding: 8px 20px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  text-align: left;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.summary-label {
  font-size: 13px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  text-align: right;

  &--accent {
    color: var(--color-primary);
  }
}

.complete-footer {
  margin-top: auto;
  padding-top: 30px;
  width: 100%;
}

.reset-btn {
  min-height: 50px;
  margin-top: 12px;
  font-size: 14px;
}
</style>
