import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resDir = path.join(root, 'android/app/src/main/res')

// 与 App 主题一致的蓝紫渐变
const gradient = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#8B7CF6"/>
    <stop offset="100%" stop-color="#4A49B8"/>
  </linearGradient>`

// 首字母 F：圆头线条，光学居中于自适应图标安全区内（中心 72dp 圆）
const letterF = `
  <g stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M41 33 L41 75"/>
    <path d="M41 33 L67 33"/>
    <path d="M41 55 L59 55"/>
  </g>`

const wrap = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">${defs}${body}</svg>`

const svgs = {
  // 自适应图标前景：透明底 + 白色 F
  foreground: wrap(letterF),
  // 传统图标：渐变底 + 白色 F
  launcher: wrap(`<rect width="108" height="108" fill="url(#bg)"/>${letterF}`, `<defs>${gradient}</defs>`),
  // 圆形图标：圆形裁剪
  round: wrap(
    `<g clip-path="url(#circle)"><rect width="108" height="108" fill="url(#bg)"/>${letterF}</g>`,
    `<defs>${gradient}<clipPath id="circle"><circle cx="54" cy="54" r="54"/></clipPath></defs>`
  )
}

// Android 各密度倍率
const densities = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4]
]

for (const [density, scale] of densities) {
  const dir = path.join(resDir, `mipmap-${density}`)
  fs.mkdirSync(dir, { recursive: true })

  for (const [name, svg] of Object.entries(svgs)) {
    // 前景用 108dp 基准，传统/圆形图标用 48dp 基准
    const dp = name === 'foreground' ? 108 : 48
    const size = Math.round(dp * scale)
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: size }
    }).render().asPng()

    const file = name === 'launcher' ? 'ic_launcher.png' : `ic_launcher_${name}.png`
    fs.writeFileSync(path.join(dir, file), png)
    console.log(`${density}/${file}  ${size}x${size}`)
  }
}

console.log('\nAll launcher icons generated.')
