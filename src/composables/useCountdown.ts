import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 基于时间戳的倒计时驱动。
 *
 * 设计要点（针对 Android 锁屏 / 切后台）：
 * - 不依赖 setInterval 的累计次数。真实剩余时间始终由 endAt - Date.now() 计算。
 * - 定时器只用于推动界面刷新；即使后台被冻结，回到前台立即重算并校准。
 * - 暂停时由外部记录 remaining；继续时外部重算 endAt。
 * - 到期只通过 onFinish 回调通知一次，绝不自动修改训练进度。
 * - 组件卸载时清理定时器与事件监听。
 *
 * 本 composable 不持有业务状态，只负责"何时刷新、何时到期"。
 * 计时状态（endAt / remaining / status）由 Pinia store 统一管理并持久化。
 */
export function useCountdown(options: {
  /** 是否处于运行态（由 store 的 timer.status === 'running' 派生） */
  isRunning: () => boolean
  /** 运行时的结束时间戳（毫秒） */
  endAt: () => number | null
  /** 每次刷新调用，返回当前剩余整数秒；由 store 依据 endAt 计算 */
  tick: () => number
  /** 倒计时归零时触发一次（业务决定是否推进，本模块不自动推进） */
  onFinish: () => void
}) {
  const now = ref(Date.now())
  let timerId: ReturnType<typeof setInterval> | undefined
  let finished = false

  function refresh() {
    now.value = Date.now()
    if (!options.isRunning()) {
      finished = false
      return
    }
    const remaining = options.tick()
    // 到期：只触发一次，避免重复回调导致重复记录
    if (remaining <= 0) {
      if (!finished) {
        finished = true
        options.onFinish()
      }
    } else {
      finished = false
    }
  }

  function startLoop() {
    stopLoop()
    finished = false
    refresh()
    timerId = setInterval(refresh, 250)
  }

  function stopLoop() {
    if (timerId != null) {
      clearInterval(timerId)
      timerId = undefined
    }
  }

  /** 从前台恢复 / 锁屏解锁后立即校准 */
  function handleVisible() {
    if (document.visibilityState === 'visible') refresh()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', refresh)
    startLoop()
  })

  onUnmounted(() => {
    stopLoop()
    document.removeEventListener('visibilitychange', handleVisible)
    window.removeEventListener('focus', refresh)
  })

  return { startLoop, stopLoop, refresh }
}
