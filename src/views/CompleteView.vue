<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Check } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'

const store = useWorkoutStore()
const router = useRouter()

async function handleReset() {
  await store.reset()
  router.push('/')
}
</script>

<template>
  <main class="page">
    <div class="done">
      <div class="done-icon">
        <Check :size="34" :stroke-width="3.2" />
      </div>
      <h1 class="done-title">今日训练完成</h1>
      <p class="done-sub">{{ store.title }}</p>

      <div class="stats">
        <div class="stat">
          <b>{{ store.total }}</b>
          <span>完成动作</span>
        </div>
        <div class="stat">
          <b>{{ store.dateLabel }}</b>
          <span>训练日期</span>
        </div>
      </div>
    </div>

    <footer class="footer">
      <button class="btn btn-primary" @click="router.push('/')">返回首页</button>
      <button class="btn btn-ghost" @click="handleReset">重新训练</button>
    </footer>
  </main>
</template>

<style scoped lang="less">
.done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.done-icon {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--success);
  box-shadow: 0 8px 20px rgba(18, 163, 119, 0.24);
  animation: pop 0.42s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.done-title {
  margin: 20px 0 0;
  font-size: 22px;
  font-weight: 800;
}

.done-sub {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-soft);
}

.stats {
  display: flex;
  align-items: stretch;
  width: 100%;
  margin-top: 28px;
  padding: 14px 0;
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: var(--shadow);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  & + .stat {
    border-left: 1px solid var(--line);
  }

  b {
    font-size: 18px;
    font-weight: 800;
  }

  span {
    font-size: 12px;
    color: var(--text-muted);
  }
}
</style>
