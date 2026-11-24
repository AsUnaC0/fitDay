/**
 * 内置预设训练计划：哑铃训练、徒手训练。
 *
 * - 由 storage 层在首次启动 / 版本升级时注入到用户计划列表，注入后即为普通用户计划，可编辑、复制、删除。
 * - id 固定且全局唯一；动作 id 同样固定，保证跨版本的完成记录不错位。
 * - weekday：1=周一 ... 7=周日。
 *
 * 动作元数据说明（训练执行模块数据驱动）：
 * - type：'reps'（次数）/ 'timer'（计时）。缺省时由 reps 文本推断（含"秒"视为计时）。
 * - sets：组数。时长类动作（走路、拉伸）无组数，执行时按 1 组处理。
 * - duration：计时训练每组秒数。
 * - restSeconds：组间休息秒数；未配置则不显示休息计时。
 *
 * 数据来源：用户提供的《一周哑铃居家训练计划》与《一周徒手训练计划》。
 * 图片示例链接不纳入动作数据（Exercise 不承载图片字段）。
 */
import type { WorkoutPlan } from '@/types'

const dumbbellPlan: WorkoutPlan = {
  id: 'preset-dumbbell',
  name: '哑铃训练',
  isDefault: false,
  days: [
    {
      weekday: 1,
      title: '胸部 + 肩部 + 背部 + 三头',
      notes: '上肢 A · 约 40 分钟 · 训练前热身 5 分钟',
      exercises: [
        { id: 'db-mon-001', name: '哑铃地板卧推', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-mon-002', name: '双臂哑铃俯身划船', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-mon-003', name: '哑铃站姿推举', sets: 2, reps: '10–12', restSeconds: 60 },
        { id: 'db-mon-004', name: '哑铃侧平举', sets: 3, reps: '12–15', restSeconds: 45 },
        { id: 'db-mon-005', name: '哑铃颈后臂屈伸', sets: 2, reps: '12–15', restSeconds: 45 }
      ]
    },
    {
      weekday: 2,
      title: '大腿 + 臀部 + 腹部',
      notes: '下肢 A · 约 40 分钟 · 膝盖不适时停止或调整',
      exercises: [
        { id: 'db-tue-001', name: '哑铃辅助坐站深蹲', sets: 3, reps: '10–12', restSeconds: 75 },
        { id: 'db-tue-002', name: '哑铃罗马尼亚硬拉', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-tue-003', name: '哑铃站姿提踵', sets: 3, reps: '15–20', restSeconds: 45 },
        { id: 'db-tue-004', name: '站姿交替提膝', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'db-tue-005', name: '站姿收腹', type: 'timer', sets: 3, duration: 20, reps: '20秒', restSeconds: 30 }
      ]
    },
    {
      weekday: 3,
      title: '主动恢复 · 低冲击有氧',
      notes: '约 25–35 分钟 · 不做力量训练，不跑步、不跳绳',
      exercises: [
        { id: 'db-wed-001', name: '室内低冲击走路', reps: '15–20分钟' },
        { id: 'db-wed-002', name: '原地轻松踏步', reps: '5分钟' },
        { id: 'db-wed-003', name: '全身轻度拉伸', reps: '5–10分钟' }
      ]
    },
    {
      weekday: 4,
      title: '背部 + 胸部 + 肩部 + 二头',
      notes: '上肢 B · 约 40 分钟 · 大肌群组间休息 75–90 秒',
      exercises: [
        { id: 'db-thu-001', name: '单臂哑铃划船', sets: 3, reps: '12–15 / 侧', restSeconds: 75 },
        { id: 'db-thu-002', name: '哑铃地板卧推', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-thu-003', name: '哑铃俯身反向飞鸟', sets: 2, reps: '12–15', restSeconds: 45 },
        { id: 'db-thu-004', name: '哑铃侧平举', sets: 2, reps: '12–15', restSeconds: 45 },
        { id: 'db-thu-005', name: '哑铃交替弯举', sets: 3, reps: '12–15 / 侧', restSeconds: 45 },
        { id: 'db-thu-006', name: '哑铃锤式弯举', sets: 2, reps: '12 / 侧', restSeconds: 45 }
      ]
    },
    {
      weekday: 5,
      title: '大腿 + 臀部 + 手臂 + 腹部',
      notes: '下肢 B · 约 40 分钟 · 分腿动作出现膝痛时停止或调整',
      exercises: [
        { id: 'db-fri-001', name: '哑铃相扑深蹲', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-fri-002', name: '哑铃罗马尼亚硬拉', sets: 3, reps: '12–15', restSeconds: 75 },
        { id: 'db-fri-003', name: '原地分腿站姿重心转移', sets: 2, reps: '10 / 侧', restSeconds: 45 },
        { id: 'db-fri-004', name: '哑铃交替弯举', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'db-fri-005', name: '哑铃仰卧臂屈伸', sets: 2, reps: '12', restSeconds: 45 },
        { id: 'db-fri-006', name: '死虫式', sets: 2, reps: '10 / 侧', restSeconds: 45 }
      ]
    },
    {
      weekday: 6,
      title: '全身轻量循环 + 有氧',
      notes: '约 40–50 分钟 · 身体疲劳时只做有氧即可',
      exercises: [
        { id: 'db-sat-001', name: '哑铃地板卧推', sets: 2, reps: '15', restSeconds: 60 },
        { id: 'db-sat-002', name: '哑铃划船', sets: 2, reps: '15', restSeconds: 60 },
        { id: 'db-sat-003', name: '哑铃坐站深蹲', sets: 2, reps: '10', restSeconds: 60 },
        { id: 'db-sat-004', name: '室内走路或平地步行', reps: '20–30分钟' }
      ]
    },
    {
      weekday: 7,
      title: '完全休息 · 轻度拉伸',
      notes: '正常休息，保证睡眠 · 拉伸 5–10 分钟（可选）',
      exercises: [{ id: 'db-sun-001', name: '全身轻度拉伸', reps: '5–10分钟（可选）' }],
      isRestDay: true
    }
  ]
}

const bodyweightPlan: WorkoutPlan = {
  id: 'preset-bodyweight',
  name: '徒手训练',
  isDefault: false,
  days: [
    {
      weekday: 1,
      title: '胸部 + 肩部 + 三头 + 背部',
      notes: '约 30–40 分钟 · 训练前热身 5 分钟',
      exercises: [
        { id: 'bw-mon-001', name: '靠墙俯卧撑', sets: 3, reps: '12–15', restSeconds: 60 },
        { id: 'bw-mon-002', name: '墙壁肩部推压（站姿）', sets: 2, reps: '10–12', restSeconds: 45 },
        { id: 'bw-mon-003', name: '站姿手臂画圈', type: 'timer', sets: 3, duration: 20, reps: '20秒', restSeconds: 30 },
        { id: 'bw-mon-004', name: '墙壁肩胛俯卧撑', sets: 2, reps: '12', restSeconds: 45 },
        { id: 'bw-mon-005', name: '站姿手臂后伸夹紧', sets: 2, reps: '15', restSeconds: 45 }
      ]
    },
    {
      weekday: 2,
      title: '大腿 + 臀部 + 腹部',
      notes: '约 30–40 分钟 · 坐站深蹲臀部轻触稳定椅面',
      exercises: [
        { id: 'bw-tue-001', name: '徒手坐站深蹲', sets: 3, reps: '10–12', restSeconds: 60 },
        { id: 'bw-tue-002', name: '站姿后抬腿', sets: 3, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-tue-003', name: '站姿侧抬腿', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-tue-004', name: '站姿提踵', sets: 3, reps: '15', restSeconds: 45 },
        { id: 'bw-tue-005', name: '站姿交替提膝', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-tue-006', name: '站姿收腹', type: 'timer', sets: 3, duration: 20, reps: '20秒', restSeconds: 30 }
      ]
    },
    {
      weekday: 3,
      title: '低冲击有氧 + 恢复',
      notes: '约 25–35 分钟 · 不需要跳跃，不需要追求速度',
      exercises: [
        { id: 'bw-wed-001', name: '原地轻松走路', reps: '5分钟' },
        { id: 'bw-wed-002', name: '室内低冲击走路', reps: '15–20分钟' },
        { id: 'bw-wed-003', name: '肩部和腿部拉伸', reps: '5–10分钟' }
      ]
    },
    {
      weekday: 4,
      title: '胸部 + 肩部 + 背部 + 手臂',
      notes: '约 30–40 分钟 · 徒手对背部/二头刺激有限，以活动和肌肉控制为主',
      exercises: [
        { id: 'bw-thu-001', name: '靠墙俯卧撑', sets: 3, reps: '12–15', restSeconds: 60 },
        { id: 'bw-thu-002', name: '墙壁天使（Wall Angel）', sets: 3, reps: '10–12', restSeconds: 45 },
        { id: 'bw-thu-003', name: '站姿肩胛后缩夹背', sets: 3, reps: '15', restSeconds: 45 },
        { id: 'bw-thu-004', name: '站姿肘关节弯举等长收缩', type: 'timer', sets: 3, duration: 15, reps: '15秒', restSeconds: 30 },
        { id: 'bw-thu-005', name: '站姿手臂后伸', sets: 2, reps: '15', restSeconds: 45 }
      ]
    },
    {
      weekday: 5,
      title: '大腿 + 臀部 + 腹部',
      notes: '约 30–40 分钟 · 腿后弯举脚跟向臀部方向抬起',
      exercises: [
        { id: 'bw-fri-001', name: '徒手坐站深蹲', sets: 3, reps: '10–12', restSeconds: 60 },
        { id: 'bw-fri-002', name: '站姿腿后弯举', sets: 3, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-fri-003', name: '站姿后抬腿', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-fri-004', name: '站姿侧抬腿', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-fri-005', name: '站姿交叉提膝', sets: 2, reps: '10 / 侧', restSeconds: 45 },
        { id: 'bw-fri-006', name: '站姿收腹', type: 'timer', sets: 2, duration: 20, reps: '20秒', restSeconds: 30 }
      ]
    },
    {
      weekday: 6,
      title: '全身徒手循环 + 有氧',
      notes: '约 35–45 分钟 · 不需要做到力竭，主要增加活动量',
      exercises: [
        { id: 'bw-sat-001', name: '靠墙俯卧撑', sets: 2, reps: '12', restSeconds: 45 },
        { id: 'bw-sat-002', name: '徒手坐站深蹲', sets: 2, reps: '10', restSeconds: 45 },
        { id: 'bw-sat-003', name: '站姿交替提膝', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-sat-004', name: '站姿侧抬腿', sets: 2, reps: '12 / 侧', restSeconds: 45 },
        { id: 'bw-sat-005', name: '站姿手臂画圈', type: 'timer', sets: 2, duration: 20, reps: '20秒', restSeconds: 30 },
        { id: 'bw-sat-006', name: '室内低冲击走路', reps: '20–30分钟' }
      ]
    },
    {
      weekday: 7,
      title: '完全休息',
      notes: '正常休息，保证睡眠 · 轻度拉伸 5–10 分钟（可选）',
      exercises: [{ id: 'bw-sun-001', name: '轻度拉伸', reps: '5–10分钟（可选）' }],
      isRestDay: true
    }
  ]
}

/** 内置预设计划列表（注入时由 storage 层深拷贝，避免引用共享） */
export const PRESET_PLANS: WorkoutPlan[] = [dumbbellPlan, bodyweightPlan]
