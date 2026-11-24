import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5174/'
const EDGE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

try {
  // 清空 localStorage，模拟首次安装
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(500)

  // 1. 启动直接进入首页（今日训练）
  const homeVisible = await page.locator('text=FitDay').count()
  check('启动直接进入今日首页', homeVisible > 0)

  // 2. 种子数据迁移：默认计划应有动作（今天是周一）
  const heroText = await page.locator('.hero-title').textContent().catch(() => '')
  check('种子计划迁移后首页显示训练主题', !!heroText, heroText ?? '')

  // 3. 进入计划列表
  await page.locator('.plans-btn').click()
  await page.waitForTimeout(400)
  const planCards = await page.locator('.plan-card').count()
  check('计划列表显示已迁移的计划', planCards >= 1, `${planCards} 套`)
  const defaultBadge = await page.locator('.default-badge').count()
  check('存在默认计划标识', defaultBadge === 1)

  // 4. 新建计划
  await page.locator('.add-btn').click()
  await page.waitForTimeout(300)
  await page.fill('#plan-name', '测试计划A')
  // 添加一个动作到周一
  await page.locator('.add-exercise').click()
  await page.waitForTimeout(200)
  await page.fill('#ex-name', '测试动作')
  await page.fill('#ex-sets', '3')
  await page.fill('#ex-reps', '12')
  await page.locator('.modal-actions .btn-primary').click()
  await page.waitForTimeout(200)
  const exRowCount = await page.locator('.ex-row').count()
  check('编辑页可添加动作', exRowCount === 1, `${exRowCount} 个动作`)
  // 设为默认并保存
  await page.locator('.switch-row').click()
  await page.locator('.edit-footer .btn-primary').click()
  await page.waitForTimeout(900)
  const cardsAfterNew = await page.locator('.plan-card').count()
  check('新建计划保存后列表增加', cardsAfterNew === planCards + 1, `${cardsAfterNew} 套`)

  // 5. 切换默认后首页显示新计划
  await page.locator('.back-btn').first().click()
  await page.waitForTimeout(500)
  const planNameOnHome = await page.locator('.hero-date').textContent().catch(() => '')
  check('切换默认计划后首页显示新计划名', (planNameOnHome ?? '').includes('测试计划A'), planNameOnHome ?? '')
  const homeTitle = await page.locator('.hero-title').textContent().catch(() => '')
  check('切换默认后首页动作来自新计划', (homeTitle ?? '').length > 0)

  // 6. 开始训练 → 完成 → 进度保存
  const startBtn = page.locator('.home-footer .btn-primary')
  if (await startBtn.count()) {
    await startBtn.click()
    await page.waitForTimeout(400)
    const trainingName = await page.locator('.exercise-name').textContent().catch(() => '')
    check('进入训练页显示当前动作', (trainingName ?? '').includes('测试动作'), trainingName ?? '')
    await page.locator('.train-footer .btn-primary').click()
    await page.waitForTimeout(400)
    const completeText = await page.locator('.complete-title').textContent().catch(() => '')
    check('完成全部动作后显示完成页', (completeText ?? '').includes('今日锻炼已完成'))
    // 返回首页再进入，进度应恢复为已完成
    await page.locator('.complete-footer .btn-primary').click()
    await page.waitForTimeout(400)
    // 刷新页面验证持久化
    await page.reload()
    await page.waitForTimeout(500)
    const doneBadge = await page.locator('.done-badge').count()
    check('刷新后完成状态恢复', doneBadge === 1)
  } else {
    check('训练流程入口存在', false, '未找到开始训练按钮')
  }

  // 7. 复制计划
  await page.locator('.plans-btn').click()
  await page.waitForTimeout(400)
  const beforeDup = await page.locator('.plan-card').count()
  await page.locator('.plan-card').first().locator('.action', { hasText: '复制' }).click()
  await page.waitForTimeout(400)
  const afterDup = await page.locator('.plan-card').count()
  check('复制计划生成新计划', afterDup === beforeDup + 1, `${beforeDup} → ${afterDup}`)

  // 8. 删除计划（非最后一套）
  await page.locator('.plan-card').first().locator('.action--danger').click()
  await page.waitForTimeout(200)
  const modalVisible = await page.locator('.modal').count()
  check('删除弹出二次确认', modalVisible === 1)
  await page.locator('.modal-actions .btn-danger').click()
  await page.waitForTimeout(400)
  const afterDel = await page.locator('.plan-card').count()
  check('删除计划生效', afterDel === afterDup - 1, `${afterDup} → ${afterDel}`)
} catch (e) {
  check('冒烟测试执行无异常', false, e.message)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length > 0 ? 1 : 0)
