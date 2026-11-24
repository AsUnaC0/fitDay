import { onUnmounted, ref } from 'vue'

/** 轻量提示：计划列表 / 计划编辑共用同一份 toast 状态与自动关闭逻辑 */
export function useToast(duration = 2200) {
  const toast = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  function showToast(text: string) {
    toast.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (toast.value = ''), duration)
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { toast, showToast }
}
