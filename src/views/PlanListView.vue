<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Copy,
  Layers,
  Pencil,
  Plus,
  Star,
  Trash2
} from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import type { WorkoutPlan } from '@/types'

const store = useWorkoutStore()
const router = useRouter()

/** 删除确认弹窗：保存待删除的计划 */
const pendingDelete = ref<WorkoutPlan | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(text: string) {
  toast.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function goBack() {
  router.push('/')
}

function createPlan() {
  router.push('/plans/new')
}

function editPlan(id: string) {
  router.push(`/plans/${id}/edit`)
}

async function setDefault(plan: WorkoutPlan) {
  if (plan.isDefault) return
  await store.setDefaultPlan(plan.id)
  showToast(`已将「${plan.name}」设为默认计划`)
}

async function duplicate(plan: WorkoutPlan) {
  await store.duplicatePlan(plan.id)
  showToast('已复制一份计划')
}

function askDelete(plan: WorkoutPlan) {
  pendingDelete.value = plan
}

async function confirmDelete() {
  const plan = pendingDelete.value
  if (!plan) return
  const result = await store.deletePlan(plan.id)
  pendingDelete.value = null
  if (!result.ok) {
    showToast(result.reason ?? '删除失败')
    return
  }
  showToast(plan.isDefault ? '已删除，已自动切换默认计划，请确认' : '已删除计划')
}
</script>

<template>
  <main class="page">
    <header class="list-header">
      <button class="back-btn" aria-label="返回首页" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <div class="header-text">
        <h1 class="header-title">训练计划</h1>
        <p class="header-sub">共 {{ store.plans.length }} 套计划</p>
      </div>
      <button class="add-btn" aria-label="新建计划" @click="createPlan">
        <Plus :size="20" />
      </button>
    </header>

    <!-- 空状态 -->
    <section v-if="store.plans.length === 0" class="card empty-card">
      <div class="empty-icon"><Layers :size="36" :stroke-width="1.6" /></div>
      <h2>还没有训练计划</h2>
      <p>创建一套计划，开始你的训练吧。</p>
      <button class="btn btn-primary empty-btn" @click="createPlan">
        <Plus :size="18" /> 新建计划
      </button>
    </section>

    <!-- 计划列表 -->
    <div v-else class="plan-list">
      <article
        v-for="plan in store.plans"
        :key="plan.id"
        class="card plan-card"
        :class="{ 'is-default': plan.isDefault }"
        @click="editPlan(plan.id)"
      >
        <div class="plan-top">
          <div class="plan-name-wrap">
            <h2 class="plan-name">{{ plan.name }}</h2>
            <span v-if="plan.isDefault" class="default-badge">
              <Star :size="12" fill="currentColor" /> 默认
            </span>
          </div>
        </div>

        <div class="plan-meta">
          <span>每周 <strong>{{ store.planStats(plan).days }}</strong> 天</span>
          <span class="meta-dot">·</span>
          <span>共 <strong>{{ store.planStats(plan).exercises }}</strong> 个动作</span>
        </div>

        <div class="plan-actions" @click.stop>
          <button
            v-if="!plan.isDefault"
            class="action action--primary"
            @click="setDefault(plan)"
          >
            <Star :size="15" /> 设为默认
          </button>
          <button class="action" @click="editPlan(plan.id)">
            <Pencil :size="15" /> 编辑
          </button>
          <button class="action" @click="duplicate(plan)">
            <Copy :size="15" /> 复制
          </button>
          <button class="action action--danger" @click="askDelete(plan)">
            <Trash2 :size="15" /> 删除
          </button>
        </div>
      </article>
    </div>

    <div class="list-footer">
      <button class="btn btn-secondary" @click="createPlan">
        <Plus :size="18" /> 新建计划
      </button>
    </div>

    <!-- 删除二次确认弹窗 -->
    <Transition name="modal">
      <div v-if="pendingDelete" class="modal-mask" @click.self="pendingDelete = null">
        <div class="modal card">
          <h3 class="modal-title">删除计划</h3>
          <p class="modal-text">
            确定删除「{{ pendingDelete.name }}」吗？此操作不可撤销。
          </p>
          <p v-if="pendingDelete.isDefault" class="modal-warn">
            这是当前默认计划，删除后将自动切换其他计划为默认。
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="pendingDelete = null">取消</button>
            <button class="btn btn-danger" @click="confirmDelete">
              <Check :size="17" /> 确认删除
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
.list-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.back-btn,
.add-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn {
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
}

.add-btn {
  margin-left: auto;
  background: var(--color-primary);
  color: #fff;
  box-shadow: var(--shadow-btn);
}

.header-text {
  flex: 1;
}

.header-title {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
}

.header-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.plan-card {
  padding: 18px 18px 14px;
  border-left: 4px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.2s ease;

  &:active {
    transform: scale(0.99);
  }

  &.is-default {
    border-left-color: var(--color-primary);
  }
}

.plan-name-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-name {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.default-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.plan-meta {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-soft);

  strong {
    color: var(--color-text);
  }
}

.meta-dot {
  margin: 0 8px;
  color: var(--color-text-muted);
}

.plan-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border-radius: 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: 600;

  &--primary {
    background: var(--color-primary-soft);
    border-color: transparent;
    color: var(--color-primary);
  }

  &--danger {
    color: #e05252;
  }
}

.list-footer {
  margin-top: auto;
  padding-top: 24px;
}

.empty-card {
  margin-top: 30px;
  text-align: center;
  padding: 44px 24px;
}

.empty-icon {
  color: var(--color-primary);
  margin-bottom: 12px;
}

.empty-card h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.empty-card p {
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--color-text-soft);
}

.empty-btn {
  width: auto;
  padding: 0 26px;
  min-height: 46px;
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
  max-width: 340px;
  padding: 24px 22px;
}

.modal-title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 800;
}

.modal-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.modal-warn {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff5e6;
  color: #b8761a;
  font-size: 12px;
  line-height: 1.5;
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

.btn-danger {
  background: #e05252;
  color: #fff;
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
  white-space: nowrap;
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
