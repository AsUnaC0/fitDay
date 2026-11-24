<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkoutStore } from '@/stores/workout'

const store = useWorkoutStore()
const router = useRouter()

async function handleResume() {
  if (document.visibilityState !== 'visible') return
  // APP 从后台恢复：刷新日期 / 计划；若已跨天则回到首页展示新的一天
  const dateChanged = await store.refreshToday()
  if (dateChanged) router.replace('/')
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleResume)
  window.addEventListener('focus', handleResume)
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleResume)
  window.removeEventListener('focus', handleResume)
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>
