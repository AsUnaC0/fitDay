<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { useToast } from '@/composables/useToast'
import { weekdayLabel } from '@/utils/date'
import type { Exercise, WorkoutDay } from '@/types'

const store = useWorkoutStore()
const route = useRoute()
const router = useRouter()
const { toast, showToast } = useToast()

const planId = typeof route.params.id === 'string' ? route.params.id : ''
const isNew = !planId
const existing = planId ? store.getPlanById(planId) : null

const name = ref(existing?.name ?? '')
const setDefault = ref(existing?.isDefault ?? false)
const activeWeekday = ref(1)
const days = reactive<WorkoutDay[]>(
  existing
    ? JSON.parse(JSON.stringify(existing.days))
    : Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, exercises: [] }))
)

const errorMsg = ref('')
const showEditor = ref(false)
const editingIndex = ref(-1)
/** input[type=number] 的 v-model 会自动转成 number，故用联合类型承接 */
const form = reactive<{
  name: string
  sets: string | number
  reps: string | number
  rest: string | number
}>({
  name: '',
  sets: '',
  reps: '',
  rest: ''
})

const currentDay = computed(() => days.find((d) => d.weekday === activeWeekday.value)!)
const dayCount = (weekday: number) => days.find((d) => d.weekday === weekday)?.exercises.length ?? 0

function openAdd() {
  editingIndex.value = -1
  form.name = ''
  form.sets = ''
  form.reps = ''
  form.rest = ''
  errorMsg.value = ''
  showEditor.value = true
}

function openEdit(index: number) {
  const ex = currentDay.value.exercises[index]
  editingIndex.value = index
  form.name = ex.name
  form.sets = ex.sets != null ? String(ex.sets) : ''
  form.reps = ex.reps ?? ''
  // 未配置过休息（undefined / 0）时留空，避免把 0 写进输入框
  form.rest = ex.restSeconds ? String(ex.restSeconds) : ''
  errorMsg.value = ''
  showEditor.value = true
}

function saveExercise() {
  const exName = form.name.trim()
  const setsRaw = String(form.sets ?? '').trim()
  const repsRaw = String(form.reps ?? '').trim()
  const restRaw = String(form.rest ?? '').trim()

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
  if (restRaw) {
    const rest = Number(restRaw)
    if (!Number.isInteger(rest) || rest < 0) {
      errorMsg.value = '组间休息必须为不小于 0 的整数（秒）'
      return
    }
  }

  const prev = editingIndex.value >= 0 ? currentDay.value.exercises[editingIndex.value] : undefined
  const nextReps = repsRaw || undefined

  const exercise: Exercise = {
    id: prev ? prev.id : store.newExerciseId(),
    name: exName,
    sets: setsRaw ? Number(setsRaw) : undefined,
    reps: nextReps,
    restSeconds: restRaw ? Number(restRaw) : undefined
  }

  // 编辑既有动作时保留表单里没有的字段：备注始终保留；次数文案未改动时
  // 保留原 type / duration，避免把「计时训练 45 秒」这类配置覆盖成推断值。
  if (prev) {
    if (prev.note) exercise.note = prev.note
    if ((prev.reps ?? undefined) === nextReps) {
      if (prev.type != null) exercise.type = prev.type
      if (prev.duration != null) exercise.duration = prev.duration
    }
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

function move(index: number, offset: number) {
  const list = currentDay.value.exercises
  const target = index + offset
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
}

async function save() {
  const planName = name.value.trim()
  if (!planName) {
    errorMsg.value = '请输入计划名称'
    return
  }
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
      if (ex.restSeconds != null && (!Number.isInteger(ex.restSeconds) || ex.restSeconds < 0)) {
        errorMsg.value = `「${ex.name}」的组间休息必须为不小于 0 的整数`
        return
      }
    }
  }

  await store.savePlan({
    id: isNew ? undefined : planId,
    name: planName,
    // 保留日级字段（title / notes / isRestDay），只覆盖动作列表；
    // 否则一保存就会把「胸部 + 肩部」这类当天主题和备注清空。
    days: days.map((d) => ({ ...d, exercises: d.exercises })),
    setDefault: setDefault.value
  })
  showToast('已保存')
  setTimeout(() => router.push('/plans'), 400)
}
</script>

<template>
  <main class="page">
    <header class="topbar">
      <button class="icon-btn" aria-label="返回计划列表" @click="router.push('/plans')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="topbar-title">{{ isNew ? '新建计划' : '编辑计划' }}</h1>
      <button class="save-btn" @click="save">保存</button>
    </header>

    <p v-if="errorMsg && !showEditor" class="alert">{{ errorMsg }}</p>

    <section class="card">
      <input
        v-model="name"
        class="text-input"
        type="text"
        placeholder="计划名称，如：居家徒手训练"
        maxlength="30"
      />
      <label class="switch-row" for="default-switch">
        <span>设为默认计划</span>
        <input id="default-switch" v-model="setDefault" type="checkbox" class="switch-input" />
        <span class="switch" :class="{ on: setDefault }"><i></i></span>
      </label>
    </section>

    <div class="week-tabs">
      <button
        v-for="wd in 7"
        :key="wd"
        class="week-tab"
        :class="{ active: activeWeekday === wd }"
        @click="activeWeekday = wd"
      >
        {{ weekdayLabel(wd).slice(-1) }}
        <i v-if="dayCount(wd) > 0" class="tab-dot"></i>
      </button>
    </div>

    <section class="card">
      <input
        v-model="currentDay.title"
        class="text-input day-title-input"
        type="text"
        maxlength="30"
        placeholder="当天主题（可留空），如：胸部 + 肩部"
      />
      <div class="day-head">
        <span class="day-count">{{ currentDay.exercises.length }} 个动作</span>
        <button class="mini-btn" @click="openAdd">
          <Plus :size="14" />
          添加
        </button>
      </div>

      <p v-if="currentDay.exercises.length === 0" class="day-empty">休息日，暂无动作</p>

      <TransitionGroup v-else name="ex-list" tag="ul" class="ex-list">
        <li v-for="(ex, idx) in currentDay.exercises" :key="ex.id" class="ex-row">
          <div class="ex-info">
            <p class="ex-name">{{ ex.name }}</p>
            <p class="ex-meta">
              <template v-if="ex.sets">{{ ex.sets }} 组</template>
              <template v-if="ex.sets && ex.reps"> × </template>
              <template v-if="ex.reps">{{ ex.reps }}</template>
              <template v-if="!ex.sets && !ex.reps">未填写组数/次数</template>
              <template v-if="ex.restSeconds"> · 休息 {{ ex.restSeconds }} 秒</template>
            </p>
          </div>
          <div class="ex-tools">
            <button class="tool" :disabled="idx === 0" aria-label="上移" @click="move(idx, -1)">
              <ArrowUp :size="15" />
            </button>
            <button
              class="tool"
              :disabled="idx === currentDay.exercises.length - 1"
              aria-label="下移"
              @click="move(idx, 1)"
            >
              <ArrowDown :size="15" />
            </button>
            <button class="tool" aria-label="编辑" @click="openEdit(idx)">
              <Pencil :size="15" />
            </button>
            <button class="tool tool--danger" aria-label="删除" @click="removeExercise(idx)">
              <Trash2 :size="15" />
            </button>
          </div>
        </li>
      </TransitionGroup>
    </section>

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

          <div class="form-row">
            <div class="form-col">
              <label class="field-label" for="ex-rest">组间休息（秒）</label>
              <input
                id="ex-rest"
                v-model="form.rest"
                class="text-input"
                type="number"
                min="0"
                inputmode="numeric"
                placeholder="如 60，留空或 0 表示不休息"
              />
            </div>
          </div>
          <p class="field-hint">每完成一组后倒计时，最后一组结束不再休息。</p>

          <p v-if="errorMsg" class="modal-error">{{ errorMsg }}</p>

          <div class="modal-actions">
            <button class="btn btn-ghost" @click="showEditor = false">取消</button>
            <button class="btn btn-primary" @click="saveExercise">确定</button>
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
.save-btn {
  flex-shrink: 0;
  height: 34px;
  padding: 0 16px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-btn);
  transition: transform 0.12s ease;

  &:active {
    transform: scale(0.95);
  }
}

.week-tabs {
  display: flex;
  gap: 6px;
}

.week-tab {
  position: relative;
  flex: 1;
  height: 38px;
  border-radius: 10px;
  background: var(--card);
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow);
  transition: background 0.15s ease, color 0.15s ease;

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: var(--shadow-btn);
  }
}

.tab-dot {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--primary);
}

.active .tab-dot {
  background: rgba(255, 255, 255, 0.85);
}

.day-title-input {
  margin-bottom: 12px;
}

.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.day-count {
  font-size: 12px;
  color: var(--text-muted);
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}

.day-empty {
  margin: 0;
  padding: 30px 0 22px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.ex-list {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 上移 / 下移：Vue 的 FLIP 让行平滑滑动，而不是瞬间换位 */
.ex-list-move,
.ex-list-enter-active {
  transition:
    transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 0.18s ease;
}

.ex-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.ex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);

  /* 只去分隔线、不改 padding，保证每行等高，换位动画不会在末行跳一下 */
  &:last-child {
    border-bottom: none;
  }
}

.ex-info {
  flex: 1;
  min-width: 0;
}

.ex-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ex-meta {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.ex-tools {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.tool {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--text-soft);

  &--danger {
    color: var(--danger);
  }

  &:disabled {
    opacity: 0.35;
  }
}

.form-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.form-col {
  flex: 1;
  min-width: 0;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.modal-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--danger);
}
</style>
