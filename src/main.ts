import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useWorkoutStore } from './stores/workout'
import './assets/styles/main.less'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // 挂载前先读取本地缓存并完成跨天校验，避免页面闪烁
  const store = useWorkoutStore(pinia)
  await store.init()

  app.use(router)
  app.mount('#app')
}

bootstrap()
