import { chromium } from 'playwright-core'

/** 先启动开发服务器：npx vite --port 5174；如需换端口用 FITDAY_URL 覆盖 */
const BASE = process.env.FITDAY_URL ?? 'http://127.0.0.1:5174/'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

/** 今天对应的 weekday（1=周一 ... 7=周日） */
const todayWeekday = await page.evaluate(() => {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
})

const text = async (sel) => (await page.locator(sel).first().textContent().catch(() => '')) ?? ''

try {
  /* ---------- A. 首次安装 / 计划管理 / 训练闭环 ---------- */
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(600)

  check('启动直接进入今日首页', (await page.locator('.hero-title, .rest-title, .empty-card h2').count()) > 0)
  const homeTitle = await text('.hero-title')
  check('首页展示今日训练主题', !!homeTitle, homeTitle)

  await page.locator('.plans-btn').click()
  await page.waitForTimeout(400)
  const planCards = await page.locator('.plan').count()
  check('计划列表显示内置计划', planCards >= 2, `${planCards} 套`)
  check('存在默认计划标识', (await page.locator('.badge').count()) === 1)

  // 新建计划：动作加到「今天」所在的星期
  await page.locator('.icon-btn--primary').click()
  await page.waitForTimeout(300)
  await page.fill('.text-input', '测试计划A')
  await page.locator('.week-tab').nth(todayWeekday - 1).click()
  await page.locator('.mini-btn').click()
  await page.waitForTimeout(200)
  await page.fill('#ex-name', '测试动作')
  await page.fill('#ex-sets', '2')
  await page.fill('#ex-reps', '10')
  await page.locator('.modal-actions .btn-primary').click()
  await page.waitForTimeout(200)
  check('编辑页可添加动作', (await page.locator('.ex-row').count()) === 1)
  await page.locator('.switch-row').click()
  await page.locator('.save-btn').click()
  await page.waitForTimeout(900)
  const cardsAfterNew = await page.locator('.plan').count()
  check('新建计划保存后列表增加', cardsAfterNew === planCards + 1, `${cardsAfterNew} 套`)

  await page.locator('.icon-btn').first().click()
  await page.waitForTimeout(500)
  const planNameOnHome = await text('.hero-date')
  check('切换默认计划后首页显示新计划', planNameOnHome.includes('测试计划A'), planNameOnHome)

  // 训练闭环
  await page.locator('.home-footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('进入训练页显示当前动作', (await text('.name')) === '测试动作', await text('.name'))
  check('组数方块数量正确', (await page.locator('.set').count()) === 2)

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(300)
  check('完成一组后组数方块标记完成', (await page.locator('.set.is-done').count()) === 1)
  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(300)
  check('全组完成后主按钮变为下一项', (await text('.footer .btn-primary')).includes('完成今日训练'))
  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('完成全部动作后显示完成页', (await text('.done-title')).includes('今日训练完成'))
  check('完成页统计动作数', (await text('.stat b')) === '1')

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForTimeout(600)
  check('刷新后完成状态恢复', (await page.locator('.exercise-item.is-completed').count()) === 1)

  // 编辑已有计划（覆盖更新分支）
  await page.locator('.plans-btn').click()
  await page.waitForTimeout(400)
  await page.locator('.plan', { hasText: '测试计划A' }).click()
  await page.waitForTimeout(400)
  await page.fill('.text-input', '测试计划B')
  await page.locator('.save-btn').click()
  await page.waitForTimeout(800)
  check('编辑已有计划名称生效', (await page.locator('.plan', { hasText: '测试计划B' }).count()) === 1)

  // 复制 / 删除
  const beforeDup = await page.locator('.plan').count()
  await page.locator('[aria-label="复制计划"]').first().click()
  await page.waitForTimeout(400)
  check('复制计划生成新计划', (await page.locator('.plan').count()) === beforeDup + 1)
  await page.locator('[aria-label="删除计划"]').first().click()
  await page.waitForTimeout(250)
  check('删除弹出二次确认', (await page.locator('.modal').count()) === 1)
  await page.locator('.modal .btn-danger').click()
  await page.waitForTimeout(400)
  check('删除计划生效', (await page.locator('.plan').count()) === beforeDup)

  /* ---------- B. 计时 / 组间休息 / 缓存恢复 ---------- */
  await page.evaluate(
    ({ weekday }) => {
      localStorage.clear()
      const days = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, exercises: [] }))
      days[weekday - 1].exercises = [
        { id: 't-1', name: '次数动作', sets: 2, reps: '10', restSeconds: 3 },
        { id: 't-2', name: '计时动作', type: 'timer', sets: 1, duration: 2, reps: '2秒' }
      ]
      const seed = {
        workout_plans: JSON.stringify([{ id: 'test-plan', name: '计时测试', isDefault: true, days }]),
        default_workout_plan_id: 'test-plan',
        workout_progress: '[]',
        'fitday:preset-version': '3'
      }
      // Capacitor Preferences 在 Web 端用 CapacitorStorage. 前缀，两个 key 都要写
      Object.entries(seed).forEach(([key, value]) => {
        localStorage.setItem(key, value)
        localStorage.setItem(`CapacitorStorage.${key}`, value)
      })
    },
    { weekday: todayWeekday }
  )
  await page.goto(BASE)
  await page.waitForTimeout(600)

  await page.locator('.home-footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('计时计划进入训练页', (await text('.name')) === '次数动作')

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('完成一组后进入组间休息', (await text('.panel-label')) === '组间休息', await text('.panel-state'))

  await page.reload()
  await page.waitForTimeout(800)
  check('刷新后休息计时恢复', (await text('.panel-label')) === '组间休息')
  check('刷新后已完成组数恢复', (await page.locator('.set.is-done').count()) === 1)

  await page.locator('.panel-actions .btn-ghost').click()
  await page.waitForTimeout(300)
  check('跳过休息回到训练态', (await page.locator('.panel').count()) === 0)

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(300)
  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('进入计时动作', (await text('.name')) === '计时动作')
  check('计时未结束时完成按钮禁用', await page.locator('.footer .btn-primary').isDisabled())

  await page.locator('.panel-actions .btn-secondary').click()
  await page.waitForTimeout(400)
  check('开始计时后按钮变为暂停', (await text('.panel-actions .btn-secondary')) === '暂停计时')
  await page.locator('.panel-actions .btn-secondary').click()
  await page.waitForTimeout(200)
  check('计时中可暂停', (await text('.panel-actions .btn-secondary')) === '继续计时')
  await page.locator('.panel-actions .btn-secondary').click()
  await page.waitForTimeout(200)
  check('暂停后可继续', (await text('.panel-actions .btn-secondary')) === '暂停计时')

  await page.waitForTimeout(2600)
  check('计时结束提示可完成本组', (await page.locator('.panel-hint').count()) === 1)
  check('计时结束后完成按钮可用', !(await page.locator('.footer .btn-primary').isDisabled()))

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(300)
  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(400)
  check('计时动作完成后进入完成页', (await text('.done-title')).includes('今日训练完成'))

  /* ---------- C. 旧日期缓存清理 ---------- */
  await page.evaluate(
    ({ weekday }) => {
      localStorage.clear()
      const days = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, exercises: [] }))
      days[weekday - 1].exercises = [{ id: 'x-1', name: '旧日期动作', sets: 2, reps: '10' }]
      const seed = {
        workout_plans: JSON.stringify([{ id: 'p2', name: '旧缓存测试', isDefault: true, days }]),
        default_workout_plan_id: 'p2',
        workout_progress: JSON.stringify([
          {
            date: '2020-01-01',
            planId: 'p2',
            currentExerciseId: 'x-1',
            exerciseProgress: { 'x-1': { completedSets: 2, completed: true } },
            timer: { kind: null, status: 'idle', endAt: null, remaining: 0, duration: 0 }
          }
        ]),
        'fitday:preset-version': '3'
      }
      Object.entries(seed).forEach(([k, v]) => {
        localStorage.setItem(k, v)
        localStorage.setItem(`CapacitorStorage.${k}`, v)
      })
    },
    { weekday: todayWeekday }
  )
  await page.goto(BASE)
  await page.waitForTimeout(600)
  check('旧日期缓存不污染今日进度', (await page.locator('.exercise-item.is-completed').count()) === 0)

  /* ---------- D. 一屏检查（三种常见竖屏尺寸） ---------- */
  await page.evaluate(() => localStorage.clear())
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 }
  ]) {
    await page.setViewportSize(size)
    await page.goto(BASE)
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => {
      const el = document.querySelector('.page')
      return { scroll: el.scrollHeight, client: el.clientHeight }
    })
    check(`首页一屏展示 ${size.width}×${size.height}`, m.scroll <= m.client + 2, `${m.scroll}/${m.client}`)
  }

  /* ---------- E. 动作很多时：页面仍一屏，列表内部滚动 ---------- */
  await page.setViewportSize({ width: 360, height: 640 })
  await page.evaluate(
    ({ weekday }) => {
      localStorage.clear()
      const days = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, exercises: [] }))
      days[weekday - 1].exercises = Array.from({ length: 9 }, (_, i) => ({
        id: `many-${i}`,
        name: `动作 ${i + 1}`,
        sets: 3,
        reps: '12–15'
      }))
      const seed = {
        workout_plans: JSON.stringify([{ id: 'many', name: '多动作计划', isDefault: true, days }]),
        default_workout_plan_id: 'many',
        workout_progress: '[]',
        'fitday:preset-version': '3'
      }
      Object.entries(seed).forEach(([k, v]) => {
        localStorage.setItem(k, v)
        localStorage.setItem(`CapacitorStorage.${k}`, v)
      })
    },
    { weekday: todayWeekday }
  )
  await page.goto(BASE)
  await page.waitForTimeout(600)
  const many = await page.evaluate(() => {
    const pageEl = document.querySelector('.page')
    const body = document.querySelector('.list-body')
    return {
      pageScroll: pageEl.scrollHeight,
      pageClient: pageEl.clientHeight,
      bodyScroll: body.scrollHeight,
      bodyClient: body.clientHeight,
      footerBottom: document.querySelector('.home-footer').getBoundingClientRect().bottom,
      viewport: window.innerHeight
    }
  })
  check('9 个动作时页面仍一屏', many.pageScroll <= many.pageClient + 2, `${many.pageScroll}/${many.pageClient}`)
  check('今日动作盒子内部可滚动', many.bodyScroll > many.bodyClient + 2, `${many.bodyScroll}/${many.bodyClient}`)
  check(
    '底部按钮仍在首屏内',
    many.footerBottom <= many.viewport + 1,
    `${Math.round(many.footerBottom)}/${many.viewport}`
  )

  /* ---------- F. 组间休息：编辑填写 → 非末组倒计时 → 末组不休息 ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(
    ({ weekday }) => {
      localStorage.clear()
      const days = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, exercises: [] }))
      days[weekday - 1].exercises = [
        { id: 'rest-1', name: '休息动作', sets: 2, reps: '10', restSeconds: 3 }
      ]
      const seed = {
        workout_plans: JSON.stringify([{ id: 'restplan', name: '休息计划', isDefault: true, days }]),
        default_workout_plan_id: 'restplan',
        workout_progress: '[]',
        'fitday:preset-version': '3'
      }
      Object.entries(seed).forEach(([k, v]) => {
        localStorage.setItem(k, v)
        localStorage.setItem(`CapacitorStorage.${k}`, v)
      })
    },
    { weekday: todayWeekday }
  )
  await page.goto(BASE)
  await page.reload()
  await page.waitForTimeout(600)
  await page.locator('.plans-btn').click()
  await page.waitForTimeout(500)
  await page.locator('.plan').first().click()
  await page.waitForTimeout(500)
  await page.locator('.week-tab').nth(todayWeekday - 1).click()
  await page.waitForTimeout(200)
  check('动作列表展示组间休息', (await text('.ex-row .ex-meta')).includes('休息 3 秒'))
  await page.locator('.ex-row').first().locator('.tool').nth(2).click()
  await page.waitForTimeout(300)
  check('编辑弹窗回填组间休息', (await page.inputValue('#ex-rest')) === '3')
  await page.locator('.modal-actions .btn-ghost').click()
  await page.waitForTimeout(200)

  await page.goto(BASE)
  await page.waitForTimeout(600)
  await page.locator('.home-footer .btn-primary').click()
  await page.waitForTimeout(500)
  check('训练页展示组间休息秒数', (await text('.amount')).includes('休息 3 秒'))
  check('未完成任何组时无休息面板', (await page.locator('.panel').count()) === 0)

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(500)
  check('完成非末组后出现组间休息', (await page.locator('.panel').count()) === 1)
  check('休息面板标题正确', (await text('.panel-label')).includes('组间休息'))
  check('休息倒计时按填写秒数起算', /00:0[0-3]/.test(await text('.clock')), await text('.clock'))

  await page.locator('.btn-ghost', { hasText: '跳过' }).click()
  await page.waitForTimeout(400)
  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(500)
  check('完成最后一组后不再休息', (await page.locator('.panel').count()) === 0)
} catch (e) {
  check('冒烟测试执行无异常', false, e.message)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length > 0 ? 1 : 0)
