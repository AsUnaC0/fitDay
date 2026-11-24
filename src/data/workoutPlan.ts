/**
 * 训练计划数据文件 —— 全应用唯一的训练信息来源。
 *
 * 维护规则：
 * - 修改训练主题、动作、组数、次数、备注、休息日，只需编辑本文件。
 * - id 必须全局唯一，否则进度记录会对应错误。
 * - weekday：1=周一 ... 7=周日。
 * - 页面 / store / 业务逻辑均不得写死星期或动作信息。
 * - 本计划为纯自重训练，无需器械（表中标注的椅子/桌子为居家常见物）。
 */

// 类型集中定义在 src/types，此处 re-export 以保持既有组件 import 路径兼容
export type { Exercise, WorkoutDay } from '@/types'
import type { WorkoutDay } from '@/types'

/**
 * 初始种子计划：仅用于首次启动时迁移为第一条用户计划。
 * 迁移后会转为 WorkoutPlan 存入本地，之后应用以存储中的计划为准，
 * 本文件不再被运行时读取（除非用户清除本地数据）。
 */
export const workoutPlan: WorkoutDay[] = [
  {
    weekday: 1,
    title: '背 + 臀腿 + 二头 + 腹',
    exercises: [
      { id: 'w-mon-001', name: '反向划船（桌沿）', sets: 4, reps: '8–12' },
      { id: 'w-mon-002', name: '超人挺身', sets: 3, reps: '12–15' },
      { id: 'w-mon-003', name: '自重深蹲', sets: 4, reps: '10–15' },
      { id: 'w-mon-004', name: '后撤弓步蹲', sets: 3, reps: '10 / 侧' },
      { id: 'w-mon-005', name: '臀桥', sets: 3, reps: '12' },
      { id: 'w-mon-006', name: '毛巾反向弯举', sets: 3, reps: '12 / 侧' },
      { id: 'w-mon-007', name: '死虫', sets: 3, reps: '12 / 侧' },
      { id: 'w-mon-008', name: '仰卧举腿', sets: 3, reps: '12' },
      { id: 'w-mon-009', name: '平板支撑', sets: 3, reps: '50s' }
    ],
    notes: '背部、腿部主训日'
  },
  {
    weekday: 2,
    title: '胸 + 肩 + 三头 + 腹',
    exercises: [
      { id: 'w-tue-001', name: '宽距俯卧撑', sets: 4, reps: '8–12' },
      { id: 'w-tue-002', name: '标准俯卧撑', sets: 3, reps: '10–12' },
      { id: 'w-tue-003', name: '折刀俯卧撑（练肩）', sets: 4, reps: '8–10' },
      { id: 'w-tue-004', name: '靠墙天使', sets: 3, reps: '15' },
      { id: 'w-tue-005', name: '钻石俯卧撑', sets: 3, reps: '8–12' },
      { id: 'w-tue-006', name: '卷腹', sets: 3, reps: '15' },
      { id: 'w-tue-007', name: '俄罗斯转体', sets: 3, reps: '14 / 侧' },
      { id: 'w-tue-008', name: '侧平板', sets: 3, reps: '40s / 侧' }
    ],
    notes: '重点练胸，做不动就跪姿俯卧撑'
  },
  {
    weekday: 3,
    title: '主动恢复',
    exercises: [
      { id: 'w-wed-001', name: '快走 / 慢跑', reps: '30–40 分钟' },
      { id: 'w-wed-002', name: '死虫', sets: 2, reps: '10 / 侧', note: '不做到力竭' },
      { id: 'w-wed-003', name: '下颌紧致练习（舌顶上颚、收下巴）', reps: '10s × 15 组' }
    ],
    notes: '不做高强度力量，恢复肌群'
  },
  {
    weekday: 4,
    title: '背 + 臀腿 + 二头 + 腹',
    exercises: [
      { id: 'w-thu-001', name: 'YTWL 俯卧伸展', sets: 4, reps: '12' },
      { id: 'w-thu-002', name: '超人挺身（停顿 2s）', sets: 3, reps: '14–16' },
      { id: 'w-thu-003', name: '窄距深蹲', sets: 4, reps: '10–15' },
      { id: 'w-thu-004', name: '前弓步蹲', sets: 3, reps: '10 / 侧' },
      { id: 'w-thu-005', name: '单腿臀桥', sets: 3, reps: '12 / 侧' },
      { id: 'w-thu-006', name: '毛巾锤式弯举', sets: 3, reps: '12' },
      { id: 'w-thu-007', name: '反向卷腹', sets: 3, reps: '12' },
      { id: 'w-thu-008', name: '侧平板', sets: 3, reps: '12 / 侧' },
      { id: 'w-thu-009', name: '登山跑', sets: 3, reps: '40s' }
    ],
    notes: '和周一动作变式，避免适应'
  },
  {
    weekday: 5,
    title: '胸 + 肩 + 三头 + 腹',
    exercises: [
      { id: 'w-fri-001', name: '下斜俯卧撑（脚放椅子）', sets: 4, reps: '6–10' },
      { id: 'w-fri-002', name: '标准俯卧撑', sets: 3, reps: '10–12' },
      { id: 'w-fri-003', name: '俯身 Y 字激活', sets: 3, reps: '15' },
      { id: 'w-fri-004', name: '靠墙臂屈伸（椅子）', sets: 3, reps: '8–12' },
      { id: 'w-fri-005', name: '钻石俯卧撑', sets: 3, reps: '8–12' },
      { id: 'w-fri-006', name: '卷腹触脚', sets: 3, reps: '14' },
      { id: 'w-fri-007', name: '停顿举腿', sets: 3, reps: '10' },
      { id: 'w-fri-008', name: '负重平板（放书）', sets: 3, reps: '45s' }
    ],
    notes: '强化胸上沿、肩后束，改善圆肩'
  },
  {
    weekday: 6,
    title: '全身循环 + 有氧 + 腹',
    exercises: [
      {
        id: 'w-sat-001',
        name: '全身循环',
        sets: 3,
        reps: '轮',
        note: '每轮：自重深蹲 15、俯卧撑 12、YTWL 12、椅子臂屈伸 10；轮休 2min'
      },
      { id: 'w-sat-002', name: '有氧（跳绳 / 快走）', reps: '30 分钟' },
      { id: 'w-sat-003', name: '仰卧举腿', sets: 3, reps: '10' },
      { id: 'w-sat-004', name: '俄罗斯转体', sets: 3, reps: '15 / 侧' },
      { id: 'w-sat-005', name: '腹横肌屏息', sets: 3, reps: '组' }
    ],
    notes: '周末时间充裕，下午训练，拉高减脂消耗'
  },
  {
    weekday: 7,
    title: '完全休息',
    exercises: [{ id: 'w-sun-001', name: '简单拉伸', note: '自愿进行，不计入打卡' }],
    notes: '保证睡眠，减少水肿，利于瘦脸',
    isRestDay: true
  }
]
