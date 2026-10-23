#!/usr/bin/env node
/**
 * 字体子集化：只保留界面里实际用到的字，生成 public/fonts/*.woff2。
 *
 * 中文字体完整文件有十几到几十 MB，而且 Google Fonts 在中国大陆不可用，
 * 所以在构建前把用到的字抽出来，随应用一起发布。改了界面文案后运行 `npm run fonts`。
 *
 * 源字体缓存在 node_modules/.cache/huishen-fonts/，缺失时从 fonts.config.json 里的 url 下载。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'node_modules/.cache/huishen-fonts')
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fonts.config.json'), 'utf8'))

// 去掉注释，避免把只在注释里出现的字也打进字体
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function collectText(patterns) {
  let text = ''
  for (const pattern of patterns) {
    for (const file of fs.globSync(pattern, { cwd: ROOT })) {
      const raw = fs.readFileSync(path.join(ROOT, file), 'utf8')
      text += /\.(ts|tsx|js|mjs|css)$/.test(file) ? stripComments(raw) : raw
    }
  }
  return text
}

async function ensureSource(source) {
  const file = path.join(CACHE, source.file)
  if (fs.existsSync(file)) return file
  if (!source.url) throw new Error(`缺少源字体 ${file}，也没有下载地址`)
  fs.mkdirSync(CACHE, { recursive: true })
  console.log(`下载 ${source.url}`)
  const res = await fetch(source.url)
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${source.url}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

function charsetOf(text, ranges) {
  const re = new RegExp(`[${ranges}]`, 'u')
  return [...new Set([...text].filter(c => re.test(c)))].sort()
}

const report = []
for (const font of config.fonts) {
  const srcFile = await ensureSource(font.source)
  const text = collectText(font.include ?? []) + (font.extra ?? '')
  const chars = charsetOf(text, font.ranges)
  const opts = { targetFormat: 'woff2' }
  if (font.variationAxes) opts.variationAxes = font.variationAxes
  const out = await subsetFont(fs.readFileSync(srcFile), chars.join(''), opts)
  const outFile = path.join(ROOT, font.out)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, out)
  report.push({
    name: font.name,
    file: font.out,
    chars: chars.length,
    kb: Math.round(out.length / 102.4) / 10,
    sha256: createHash('sha256').update(out).digest('hex').slice(0, 12),
  })
  // 记下收录的字，测试用它检查界面文字是否都被覆盖
  fs.writeFileSync(`${outFile}.chars.txt`, chars.join(''))
}
console.table(report)
