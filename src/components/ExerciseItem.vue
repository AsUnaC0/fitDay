<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { ResolvedExercise } from '@/types'
import { formatAmount } from '@/utils/exercise'

withDefaults(
  defineProps<{
    exercise: ResolvedExercise
    index: number
    completed: boolean
  }>(),
  { completed: false }
)
</script>

<template>
  <div class="exercise-item" :class="{ 'is-completed': completed }">
    <div class="exercise-index">
      <Check v-if="completed" :size="16" :stroke-width="3" />
      <span v-else>{{ index + 1 }}</span>
    </div>

    <div class="exercise-content">
      <div class="exercise-name">{{ exercise.name }}</div>
      <div v-if="formatAmount(exercise)" class="exercise-meta">{{ formatAmount(exercise) }}</div>
      <div v-if="exercise.note" class="exercise-note">{{ exercise.note }}</div>
    </div>

    <span v-if="completed" class="exercise-done-text">已完成</span>
  </div>
</template>

<style scoped lang="less">
.exercise-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);

  &:last-child {
    border-bottom: none;
  }
}

.exercise-index {
  flex: 0 0 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.exercise-content {
  flex: 1;
  min-width: 0;
}

.exercise-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}

.exercise-meta {
  margin-top: 3px;
  font-size: 13px;
  color: var(--text-soft);
}

.exercise-note {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.exercise-done-text {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--success);
}

.is-completed {
  .exercise-index {
    background: var(--success-soft);
    color: var(--success);
  }

  .exercise-name,
  .exercise-meta {
    color: var(--text-muted);
    text-decoration: line-through;
    text-decoration-color: var(--text-muted);
  }

  .exercise-note {
    text-decoration: none;
  }
}
</style>
