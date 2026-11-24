<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Save,
  Trash2
} from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { WEEKDAY_LABELS } from '@/utils/date'
import type { Exercise, WorkoutDay } from '@/types'

const store = useWorkoutStore()
const route = useRoute()
const router = useRouter()

const planId = typeof route.params.id === 'string' ? route.params.id : ''
const isNew = !planId
const existing = planId ? store.getPlanById(planId) : null

// 草稿状态
const name = ref(existing?.name ?? '')
const setDefault = ref(existing?.isDefault ?? false)
const activeWeekday = ref(1)
const days = reactive<WorkoutDay[]>(
  existing
    ? JSON.parse(JSON.stringify(existing.days))
    : Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, exercises: [] }))
)

const errorMsg = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(text: string) {
  toast.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

const currentDay = computed(() => days.find((d) => d.weekday === activeWeekday.value)!)

/** 动作编辑弹窗状态 */
const showEditor = ref(false)
const editingIndex = ref(-1)
const form = reactive<{ name: string; sets: string | number; reps: string | number }>({
  name: '',
  sets: '',
  reps: ''
})

function openAdd() {
  editingIndex.value = -1
  form.name = ''
  form.sets = ''
  form.reps = ''
  errorMsg.value = ''
  showEditor.value = true
}

function openEdit(index: number) {
  const ex = currentDay.value.exercises[index]
  editingIndex.value = index
  form.name = ex.name
  form.sets = ex.sets != null ? String(ex.sets) : ''
  form.reps = ex.reps ?? ''
  errorMsg.value = ''
  showEditor.value = true
}

function saveExercise() {
  const exName = form.name.trim()
  // input[type=number] 的 v-model 可能是 number，统一转字符串再处理
  const setsRaw = String(form.sets ?? '').trim()
  const repsRaw = String(form.reps ?? '').trim()

  if (!exName) {
    errorMsg.value = '请输入动作名称'
    return
  }
  if (!setsRaw && !repsRaw) {
    errorMsg.value = '组数和次数至少填写一项'
    return
  }
  if (setsRaw) {
    const sets = Number(setsRaw)
    if (!Number.isInteger(sets) || sets <= 0) {
      errorMsg.value = '组数必须为大于 0 的整数'
      return
    }
  }

  const exercise: Exercise = {
    id: editingIndex.value >= 0 ? currentDay.value.exercises[editingIndex.value].id : store.newExerciseId(),
    name: exName,
    sets: setsRaw ? Number(setsRaw) : undefined,
    reps: repsRaw || undefined
  }

  if (editingIndex.value >= 0) {
    currentDay.value.exercises[editingIndex.value] = exercise
  } else {
    currentDay.value.exercises.push(exercise)
  }
  showEditor.value = false
}

function removeExercise(index: number) {
  currentDay.value.exercises.splice(index, 1)
}

function moveUp(index: number) {
  if (index <= 0) return
  const list = currentDay.value.exercises
  ;[list[index - 1], list[index]] = [list[index], list[index - 1]]
}

function moveDown(index: number) {
  const list = currentDay.value.exercises
  if (index >= list.length - 1) return
  ;[list[index + 1], list[index]] = [list[index], list[index + 1]]
}

function dayExerciseCount(weekday: number): number {
  return days.find((d) => d.weekday === weekday)?.exercises.length ?? 0
}

async function save() {
  const planName = name.value.trim()
  if (!planName) {
    errorMsg.value = '请输入计划名称'
    document.querySelector('.page')?.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  // 校验所有动作：名称非空、组数为正整数（若填）
  for (const day of days) {
    for (const ex of day.exercises) {
      if (!ex.name.trim()) {
        errorMsg.value = '存在未命名的动作，请补全'
        return
      }
      if (ex.sets != null && (!Number.isInteger(ex.sets) || ex.sets <= 0)) {
        errorMsg.value = `「${ex.name}」的组数必须为大于 0 的整数`
        return
      }
    }
  }

  await store.savePlan({
    id: isNew ? undefined : planId,
    name: planName,
    days: days.map((d) => ({ weekday: d.weekday, exercises: d.exercises })),
    setDefault: setDefault.value
  })
  showToast('已保存')
  setTimeout(() => router.push('/plans'), 500)
}

function goBack() {
  router.push('/plans')
}
</script>

<template>
  <main class="page">
    <header class="edit-header">
      <button class="back-btn" aria-label="返回计划列表" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="header-title">{{ isNew ? '新建计划' : '编辑计划' }}</h1>
    </header>

    <div v-if="errorMsg && !showEditor" class="error-banner">{{ errorMsg }}</div>

    <!-- 基本信息 -->
    <section class="card basic-card">
      <label class="field-label" for="plan-name">计划名称</label>
      <input
        id="plan-name"
        v-model="name"
        class="text-input"
        type="text"
        placeholder="例如：居家徒手训练"
        maxlength="30"
      />

      <label class="switch-row" for="default-switch">
        <span class="switch-label">
          <strong>设为默认计划</strong>
          <small>默认计划用于首页今日训练</small>
        </span>
        <input
          id="default-switch"
          v-model="setDefault"
          type="checkbox"
          class="switch-input"
        />
        <span class="switch-visual" :class="{ on: setDefault }"><span class="knob"></span></span>
      </label>
    </section>

    <!-- 周一至周日切换 -->
    <div class="week-tabs">
      <button
        v-for="wd in 7"
        :key="wd"
        class="week-tab"
        :class="{ active: activeWeekday === wd, has: dayExerciseCount(wd) > 0 }"
        @click="activeWeekday = wd"
      >
        {{ WEEKDAY_LABELS[wd].replace('星期', '') }}
        <span v-if="dayExerciseCount(wd) > 0" class="tab-dot"></span>
      </button>
    </div>

    <!-- 当天动作列表 -->
    <section class="card day-card">
      <div class="day-head">
        <h2 class="day-title">{{ WEEKDAY_LABELS[activeWeekday] }}</h2>
        <span class="day-count">{{ currentDay.exercises.length }} 个动作</span>
      </div>

      <div v-if="currentDay.exercises.length === 0" class="day-empty">
        暂无动作，休息日（点击右下角添加）
      </div>

      <div v-else class="ex-list">
        <div v-for="(ex, idx) in currentDay.exercises" :key="ex.id" class="ex-row">
          <div class="ex-info">
            <div class="ex-name">{{ ex.name }}</div>
            <div class="ex-meta">
              <span v-if="ex.sets">{{ ex.sets }} 组</span>
              <span v-if="ex.sets && ex.reps">×</span>
              <span v-if="ex.reps">{{ ex.reps }}</span>
              <span v-if="!ex.sets && !ex.reps" class="muted">未填写组数/次数</span>
            </div>
          </div>
          <div class="ex-tools">
            <button class="tool" aria-label="上移" @click="moveUp(idx)"><ArrowUp :size="16" /></button>
            <button class="tool" aria-label="下移" @click="moveDown(idx)"><ArrowDown :size="16" /></button>
            <button class="tool" aria-label="编辑" @click="openEdit(idx)"><Pencil :size="16" /></button>
            <button class="tool tool--danger" aria-label="删除" @click="removeExercise(idx)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="edit-footer">
      <button class="btn btn-secondary add-exercise" @click="openAdd">
        <Plus :size="18" /> 添加动作
      </button>
      <button class="btn btn-primary" @click="save">
        <Save :size="18" /> 保存计划
      </button>
    </div>

    <!-- 动作编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showEditor" class="modal-mask" @click.self="showEditor = false">
        <div class="modal card">
          <h3 class="modal-title">{{ editingIndex >= 0 ? '编辑动作' : '添加动作' }}</h3>

          <label class="field-label" for="ex-name">动作名称</label>
          <input id="ex-name" v-model="form.name" class="text-input" type="text" placeholder="例如：俯卧撑" />

          <div class="form-row">
            <div class="form-col">
              <label class="field-label" for="ex-sets">组数</label>
              <input
                id="ex-sets"
                v-model="form.sets"
                class="text-input"
                type="number"
                min="1"
                inputmode="numeric"
                placeholder="如 4"
              />
            </div>
            <div class="form-col">
              <label class="field-label" for="ex-reps">次数 / 时长</label>
              <input
                id="ex-reps"
                v-model="form.reps"
                class="text-input"
                type="text"
                placeholder="如 12 或 30 分钟"
              />
            </div>
          </div>

          <div v-if="errorMsg" class="modal-error">{{ errorMsg }}</div>

          <div class="modal-actions">
            <button class="btn btn-ghost" @click="showEditor = false">取消</button>
            <button class="btn btn-primary" @click="saveExercise">
              <Check :size="17" /> 确定
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </main>
</template>

<style scoped lang="less">
.edit-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
}

.error-banner {
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #fdecec;
  color: #c0392b;
  font-size: 13px;
}

.basic-card {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-soft);
  margin-bottom: 7px;
}

.text-input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 15px;
  outline: none;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-text-muted);
  }
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
}

.switch-label {
  flex: 1;
  display: flex;
  flex-direction: column;

  strong {
    font-size: 14px;
    font-weight: 600;
  }

  small {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
}

.switch-input {
  display: none;
}

.switch-visual {
  flex: 0 0 46px;
  height: 26px;
  border-radius: 999px;
  background: #d5d9e6;
  padding: 3px;
  transition: background 0.2s ease;

  &.on {
    background: var(--color-primary);
  }
}

.knob {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.on .knob {
  transform: translateX(20px);
}

.week-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 6px;
  margin-bottom: 14px;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.week-tab {
  position: relative;
  flex: 0 0 auto;
  min-width: 44px;
  height: 36px;
  border-radius: 11px;
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 13px;
  font-weight: 600;

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
}

.tab-dot {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
}

.active .tab-dot {
  background: #fff;
}

.day-card {
  min-height: 160px;
}

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.day-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.day-count {
  font-size: 12px;
  color: var(--color-text-muted);
}

.day-empty {
  padding: 36px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.ex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.ex-info {
  flex: 1;
  min-width: 0;
}

.ex-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ex-meta {
  margin-top: 3px;
  font-size: 12px;
  color: var(--color-text-soft);
  display: flex;
  gap: 5px;

  .muted {
    color: var(--color-text-muted);
  }
}

.ex-tools {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.tool {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text-soft);
  display: flex;
  align-items: center;
  justify-content: center;

  &--danger {
    color: #e05252;
  }
}

.edit-footer {
  margin-top: auto;
  padding-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-exercise {
  min-height: 50px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 24, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.modal {
  width: 100%;
  max-width: 360px;
  padding: 24px 22px;
}

.modal-title {
  margin: 0 0 18px;
  font-size: 18px;
  font-weight: 800;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}

.form-col {
  flex: 1;
}

.modal-error {
  margin-top: 14px;
  color: #c0392b;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;

  .btn {
    flex: 1;
    min-height: 46px;
  }
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  background: rgba(30, 34, 60, 0.92);
  color: #fff;
  padding: 11px 18px;
  border-radius: 999px;
  font-size: 13px;
  z-index: 60;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.modal-enter-active,
.modal-leave-active,
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to,
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
