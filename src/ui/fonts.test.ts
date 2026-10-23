/**
 * 字体子集的覆盖（DESIGN.md §4.1）：src 里任何一个会显示出来的中文字，都必须在 display.woff2 里，
 * 否则标题会悄悄退回系统宋体，和别的字不是一个字形。改了文案就要重新运行 npm run fonts。
 * 这里自己去掉注释（认得字符串、模板和正则），不依赖构建脚本的做法，两边对不上时测试会指出来。
 * 文件用 import.meta.glob 读进来：不引入 Node 的类型，应用代码的类型环境保持不变。
 */
import { describe, expect, it } from 'vitest'
import config from '../../scripts/fonts.config.json'

interface FontEntry {
  out: string
  ranges: string
  extra?: string
  variationAxes?: Record<string, unknown>
}

const raw = (files: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k, String(v)]))

// 测试、__checks__ 和 __measure* 不进字体（DESIGN.md §4.1）
const SOURCES = raw(
  import.meta.glob(
    ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/__checks__/**', '!/src/**/__measure*'],
    { query: '?raw', import: 'default', eager: true },
  ),
)
const INDEX_HTML =
  Object.values(raw(import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true })))[0] ??
  ''
const CHARS = raw(
  import.meta.glob('/public/fonts/*.chars.txt', { query: '?raw', import: 'default', eager: true }),
)
// 字体文件内联成 data: 地址，从 base64 的长度算出字节数
const WOFF2 = raw(
  import.meta.glob('/public/fonts/*.woff2', { query: '?inline', import: 'default', eager: true }),
)

const fonts = (config as { fonts: FontEntry[] }).fonts
const entry = (out: string): FontEntry => {
  const found = fonts.find(f => f.out === out)
  if (!found) throw new Error(`fonts.config.json 里没有 ${out}`)
  return found
}
const charsOf = (out: string): Set<string> => new Set([...(CHARS[`/${out}.chars.txt`] ?? '')])
const bytesOf = (out: string): number => {
  const uri = WOFF2[`/${out}`] ?? ''
  const b64 = uri.slice(uri.indexOf(',') + 1)
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
}

/** 宋体要覆盖的字：汉字、CJK 标点、全角形式，以及 · — ‘ ’ “ ” …（DESIGN.md §4.1） */
const DISPLAY = /[\p{Script=Han}　-〿＀-￯·—‘’“”…]/u

/** 前一个有意义的字符是这些时，/ 开始的是正则，不是除号 */
const BEFORE_REGEX = new Set([...'(,=:[!&|?{};+-*%<>~^'])
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await)$/

/** 去掉 // 和 /* *\/ 注释，保留字符串、模板字符串、正则和 JSX 文本 */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  let lastSignificant = ''
  // 模板字符串里 ${ } 的嵌套：栈里记的是进入 ${ 时花括号的深度
  const templateStack: number[] = []
  let braceDepth = 0
  const readQuoted = (quote: string) => {
    let j = i + 1
    while (j < code.length && code[j] !== quote && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
    out += code.slice(i, j + 1)
    i = j + 1
  }
  const readTemplate = () => {
    // 从 ` 或 } 之后读到下一个 ` 或 ${
    let j = i
    while (j < code.length) {
      if (code[j] === '\\') j += 2
      else if (code[j] === '`') {
        out += code.slice(i, j + 1)
        i = j + 1
        return
      } else if (code[j] === '$' && code[j + 1] === '{') {
        out += code.slice(i, j + 2)
        i = j + 2
        templateStack.push(braceDepth)
        braceDepth++
        return
      } else j++
    }
    out += code.slice(i)
    i = code.length
  }
  while (i < code.length) {
    const c = code[i] ?? ''
    const next = code[i + 1] ?? ''
    if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end < 0 ? code.length : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      readQuoted(c)
      lastSignificant = 'a'
      continue
    }
    if (c === '`') {
      out += c
      i++
      readTemplate()
      lastSignificant = 'a'
      continue
    }
    if (c === '/') {
      const tail = out.trimEnd()
      if (BEFORE_REGEX.has(lastSignificant) || lastSignificant === '' || REGEX_KEYWORDS.test(tail)) {
        // 正则：读到不在 [] 里的下一个 /
        let j = i + 1
        let inClass = false
        while (j < code.length && code[j] !== '\n') {
          if (code[j] === '\\') j += 2
          else {
            if (code[j] === '[') inClass = true
            else if (code[j] === ']') inClass = false
            else if (code[j] === '/' && !inClass) break
            j++
          }
        }
        out += code.slice(i, j + 1)
        i = j + 1
        lastSignificant = 'a'
        continue
      }
    }
    if (c === '{') braceDepth++
    if (c === '}') {
      braceDepth--
      if (templateStack.length > 0 && templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop()
        out += c
        i++
        readTemplate()
        lastSignificant = 'a'
        continue
      }
    }
    out += c
    if (!/\s/.test(c)) lastSignificant = /[\w$\u0080-￿)\]]/.test(c) ? 'a' : c
    i++
  }
  return out
}

function displayCharsIn(text: string): Set<string> {
  return new Set([...text].filter(ch => DISPLAY.test(ch)))
}

describe('去注释', () => {
  it('认得字符串、模板和正则里的 // 与 /*', () => {
    const code = [
      "const a = 'https://例.cn' // 注释一",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 这一行是被测的源代码，里面的 ${} 就是要测的模板
      'const b = `模板 ${x /* 注释二 */ + `嵌套`} 结尾`',
      'const r = /[，。]+\\/\\/*/g /* 注释三 */',
      '<p>文本</p>',
    ].join('\n')
    const kept = stripComments(code)
    expect(kept).toContain('例')
    expect(kept).toContain('嵌套')
    expect(kept).toContain('结尾')
    expect(kept).toContain('，。')
    expect(kept).toContain('文本')
    expect(kept).not.toMatch(/注释/)
  })
})

describe('字体子集', () => {
  it('src 里会显示的每个中文字和中文标点都在 display.woff2 里（文案改了就运行 npm run fonts）', () => {
    const display = charsOf(entry('public/fonts/display.woff2').out)
    const missing = new Map<string, string>()
    const seen = new Set<string>()
    for (const [file, code] of Object.entries(SOURCES)) {
      for (const ch of displayCharsIn(stripComments(code))) {
        seen.add(ch)
        if (!display.has(ch) && !missing.has(ch)) missing.set(ch, file)
      }
    }
    // 防止测试本身失灵（比如一个文件都没扫到）
    expect(seen.size).toBeGreaterThan(800)
    for (const ch of displayCharsIn(INDEX_HTML)) {
      if (!display.has(ch) && !missing.has(ch)) missing.set(ch, 'index.html')
    }
    expect([...missing].map(([ch, file]) => `${ch} ${file}`)).toEqual([])
  })

  it('宋体的数字和 extra 里的字都收录了（「10月」这样的标题不退回系统字体）', () => {
    const font = entry('public/fonts/display.woff2')
    const display = charsOf(font.out)
    for (const ch of font.extra ?? '') expect(display.has(ch), ch).toBe(true)
    for (const d of '0123456789') expect(display.has(d), d).toBe(true)
    expect(font.variationAxes).toEqual({ wght: 600 })
  })

  it('细体只收阶段字：吸 再 停 呼 准 备，并且只取 300 字重', () => {
    const font = entry('public/fonts/display-light.woff2')
    expect([...charsOf(font.out)].sort().join('')).toBe([...'吸再停呼准备'].sort().join(''))
    expect(font.variationAxes).toEqual({ wght: 300 })
  })

  it('数字字体收齐 ASCII 和列出的符号，轴限在 300–600、14–32', () => {
    const font = entry('public/fonts/num.woff2')
    const num = charsOf(font.out)
    for (let code = 0x20; code <= 0x7e; code++) expect(num.has(String.fromCharCode(code))).toBe(true)
    for (const ch of ' °±× –′″←↑→↓−≈≤≥') expect(num.has(ch), ch).toBe(true)
    // CJK 标点和 · — “ ” 故意不在里面：中文保留全角字形
    for (const ch of '·—“”，。') expect(num.has(ch), ch).toBe(false)
    expect(font.variationAxes).toEqual({
      wght: { min: 300, max: 600, default: 400 },
      opsz: { min: 14, max: 32, default: 14 },
    })
  })

  it('三个文件加起来不超过 900 KB', () => {
    const sizes = fonts.map(f => bytesOf(f.out))
    for (const size of sizes) expect(size).toBeGreaterThan(1000)
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(900 * 1024)
  })
})
