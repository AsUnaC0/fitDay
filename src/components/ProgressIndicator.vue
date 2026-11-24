<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    current: number
    total: number
    label?: string
  }>(),
  { label: '当前进度' }
)

const percent = computed(() =>
  props.total > 0 ? Math.min(100, Math.round((props.current / props.total) * 100)) : 0
)
</script>

<template>
  <div class="progress-indicator">
    <div class="progress-head">
      <span class="progress-label">{{ label }}</span>
      <span class="progress-count">{{ current }} / {{ total }}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${percent}%` }"></div>
    </div>
  </div>
</template>

<style scoped lang="less">
.progress-indicator {
  width: 100%;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-label {
  font-size: 13px;
  color: var(--color-text-soft);
}

.progress-count {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
}

.progress-track {
  height: 8px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-primary));
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
