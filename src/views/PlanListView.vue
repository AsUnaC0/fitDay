<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Copy, Pencil, Plus, Star, Trash2 } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workout'
import { useToast } from '@/composables/useToast'
import type { WorkoutPlan } from '@/types'

const store = useWorkoutStore()
const router = useRouter()
const { toast, showToast } = useToast()

/** 删除确认弹窗：保存待删除的计划 */
const pendingDelete = ref<WorkoutPlan | null>(null)

/** 每套计划只统计一次，避免模板里重复调用 */
const cards = computed(() => store.plans.map((plan) => ({ plan, stats: store.planStats(plan) })))

async function setDefault(plan: WorkoutPlan) {
  if (plan.isDefault) return
  await store.setDefaultPlan(plan.id)
  showToast(`已将「${plan.name}」设为默认计划`)
}

async function duplicate(plan: WorkoutPlan) {
  await store.duplicatePlan(plan.id)
  showToast('已复制一份计划')
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
  showToast(plan.isDefault ? '已删除，已自动切换默认计划' : '已删除计划')
}
</script>

<template>
  <main class="page">
    <header class="topbar">
      <button class="icon-btn" aria-label="返回首页" @click="router.push('/')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="topbar-title">训练计划</h1>
      <button class="icon-btn icon-btn--primary" aria-label="新建计划" @click="router.push('/plans/new')">
        <Plus :size="20" />
      </button>
    </header>

    <!-- 空状态 -->
    <section v-if="cards.length === 0" class="card empty">
      <h2 class="empty-title">还没有训练计划</h2>
      <p class="empty-desc">创建一套计划，开始你的训练吧。</p>
      <button class="btn btn-primary" @click="router.push('/plans/new')">
        <Plus :size="17" />
        新建计划
      </button>
    </section>

    <div v-else class="plan-list">
      <article
        v-for="{ plan, stats } in cards"
        :key="plan.id"
        class="card plan"
        @click="router.push(`/plans/${plan.id}/edit`)"
      >
        <div class="plan-main">
          <div class="plan-head">
            <h2 class="plan-name">{{ plan.name }}</h2>
            <span v-if="plan.isDefault" class="badge">默认</span>
          </div>
          <p class="plan-meta">每周 {{ stats.days }} 天 · {{ stats.exercises }} 个动作</p>
        </div>

        <div class="plan-tools" @click.stop>
          <button
            class="tool"
            :class="{ 'tool--primary': plan.isDefault }"
            :disabled="plan.isDefault"
            :aria-label="plan.isDefault ? '当前默认计划' : '设为默认计划'"
            @click="setDefault(plan)"
          >
            <Star :size="15" :fill="plan.isDefault ? 'currentColor' : 'none'" />
          </button>
          <button class="tool" aria-label="编辑计划" @click="router.push(`/plans/${plan.id}/edit`)">
            <Pencil :size="15" />
          </button>
          <button class="tool" aria-label="复制计划" @click="duplicate(plan)">
            <Copy :size="15" />
          </button>
          <button class="tool tool--danger" aria-label="删除计划" @click="pendingDelete = plan">
            <Trash2 :size="15" />
          </button>
        </div>
      </article>
    </div>

    <!-- 删除二次确认 -->
    <Transition name="modal">
      <div v-if="pendingDelete" class="modal-mask" @click.self="pendingDelete = null">
        <div class="modal card">
          <h3 class="modal-title">删除计划</h3>
          <p class="modal-text">确定删除「{{ pendingDelete.name }}」吗？此操作不可撤销。</p>
          <p v-if="pendingDelete.isDefault" class="modal-warn">
            这是当前默认计划，删除后将自动切换其他计划为默认。
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="pendingDelete = null">取消</button>
            <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
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
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  transition: transform 0.12s ease;

  &:active {
    transform: scale(0.99);
  }
}

.plan-main {
  flex: 1;
  min-width: 0;
}

.plan-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
}

.plan-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.plan-tools {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.tool {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--text-soft);
  transition: background 0.12s ease;

  &:active {
    background: var(--line);
  }

  &--primary {
    background: var(--primary-soft);
    color: var(--primary);
  }

  &--danger {
    color: var(--danger);
  }

  &:disabled {
    opacity: 0.9;
    cursor: default;
  }
}

.empty {
  margin-top: 12px;
  padding: 28px 20px;
  text-align: center;
}

.empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.empty-desc {
  margin: 8px 0 18px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-soft);
}
</style>
