import { createRouter, createWebHashHistory } from 'vue-router'
import { useWorkoutStore } from '@/stores/workout'

// Capacitor 以 file:// 协议加载，必须使用 hash 模式而非 history 模式
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/training', name: 'training', component: () => import('@/views/TrainingView.vue') },
    { path: '/complete', name: 'complete', component: () => import('@/views/CompleteView.vue') },
    { path: '/plans', name: 'plans', component: () => import('@/views/PlanListView.vue') },
    { path: '/plans/new', name: 'plan-new', component: () => import('@/views/PlanEditView.vue') },
    { path: '/plans/:id/edit', name: 'plan-edit', component: () => import('@/views/PlanEditView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// 非法直接访问时按状态纠正，避免出现空白/错误页面
router.beforeEach((to) => {
  const store = useWorkoutStore()
  if (!store.isReady) return true
  if (to.name === 'training' && (store.isRestDay || store.total === 0 || store.isCompleted)) {
    return { name: 'home' }
  }
  if (to.name === 'complete' && !store.isCompleted) {
    return { name: 'home' }
  }
  return true
})

export default router
