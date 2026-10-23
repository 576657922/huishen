# 回神 · 给编码代理和工程师的工作说明

回神是一个依据研究设计的冥想、呼吸与声音练习 PWA（简体中文，手机优先，也支持桌面；离线可用、无账号、数据只在本机；所有声音在浏览器里实时合成）。用户的硬性要求：**界面和文字都必须显得专业，不能像 AI 做出来的。**

## 1. 先读这些（按顺序）

1. `docs/PRODUCT.md` — 产品规格（唯一权威：功能、默认值、规则、文案规范、安全）。
2. `docs/design/DESIGN.md` — 设计规格（颜色、字体、间距、组件和状态、动效、无障碍、§13 每个页面的「页面配方」）。设计稿在 `docs/design/final/*.png`，旁边的 `.html` 是参考实现。
3. `docs/APP.md` — 应用层规格：路由、框架、服务、hooks、开始和结束练习的流程、播放器约定、widgets、开发钩子。
4. `docs/modules.md` — 引擎、声音、数据、心率四个模块的公开接口和接线方式。
5. `docs/ARCHITECTURE.md` — 技术栈、目录、依赖方向。
6. `docs/TASKS.md` — 还没做完的事，每项都有规格出处和验收标准。从这里领任务。

研究依据：`docs/research/evidence.json`（174 条逐条核查过的结论）。文案里引用的证据 id 必须在这里存在。

## 2. 目录和归属

```
src/lib      通用工具（日期、节气、随机数、格式化）
src/content  全部中文内容：练习目录、引导词、计划、安全与求助、声音目录、今日推荐、界面文案（copy.ts）、证据卡片
src/engine   会话引擎（节拍、热身、有点急、时间线、调度、状态机），与 React 无关
src/audio    声音层（Web Audio 实时合成、AudioWorklet 真峰值限幅、响度校准）
src/data     记录（IndexedDB）、偏好（Zustand + localStorage）、统计、导出导入、日历提醒
src/hrv      心率带（Web Bluetooth）和心率变异指标，舒适节律探索用
src/ui       设计系统：tokens、基础样式、图标、组件（只做展示，不含业务逻辑）
src/app      应用外壳：路由、框架（手机标签栏 / 桌面侧栏 / 播放器框架）、服务单例、hooks、flows、计划构建
src/widgets  跨页面的业务组件（不舒服？面板、求助号码、声音选择、练完感觉、自评、开始按钮）
src/features 每个页面一个目录（today、practices、player、records、evidence、settings、help、onboarding、program、sound、pace-finder）
```

依赖方向：`lib ← content ← engine ← (audio, data, hrv) ← app ← features`；`ui`、`widgets` 供 features 使用。**features 之间不互相导入**，共用的东西放进 `ui/` 或 `widgets/`。

## 3. 不可违反的规则

- **中文只写在 `src/content`。** 组件里不写中文句子；需要新文案就加到 `src/content/copy.ts` 对应的命名空间，并通过 `copy.test.ts` 的检查（中文与数字、字母之间留空格，全角标点，不用感叹号，日期写成「2026年10月」，频率保留一位小数「6.0 次/分」）。禁用词见 PRODUCT.md §10，`findForbidden()`（`src/content/safety.ts`）会在测试里检查。
- **样式只用设计 token**（`src/ui/tokens.css`），用 CSS Modules。不用 UI 库、CSS-in-JS、Tailwind；不加外部 CDN（Google Fonts 在中国大陆不可用，字体已自托管）。新增 npm 依赖要有充分理由。
- **照设计实现，不即兴发挥。** 有设计稿的页面对照设计稿；没有设计稿的照 DESIGN.md §13 的页面配方，并沿用已有设计稿里的样式。缺组件时先看 `src/ui/components` 有没有。
- **安全规则**：播放器里「不舒服？」始终可见；求助号码只用 `src/content/safety.ts` 的 `CRISIS_RESOURCES`（不要自己加号码）；永远不显示连续天数、「已经 X 天没练」、红色的「漏练」标记；不说治疗、疗效、科学证明等（PRODUCT.md §10）。
- **v1 没有语音引导**（PRODUCT.md §0）：引导类练习是文字引导。不要接入 `speechSynthesis` 或任何在线语音。`walking`、`body-scan-sleep` 在 v1 不提供（用 content 里的 `isOffered()` 判断）。
- **会话和声音只通过 `src/app` 的服务、hooks、flows 使用**：页面里不直接创建 AudioContext，不直接调用引擎内部；开始练习必须在用户点击的处理函数里调用 `startPractice()`（浏览器要求用户手势才能出声）。
- **动画不触发每帧 React 渲染**：画布和逐帧读数用 `useSessionClock`，秒级读数用 `useSessionSecond`。
- **无障碍**：WCAG 2.2 AA；每页一个 h1；控件有可读名称；键盘可操作；焦点可见；触控目标 ≥ 44 px；尊重 `prefers-reduced-motion`。
- **隐私**：不加任何统计、埋点、远程请求。应用只在加载自身时联网。

## 4. 常用命令

```bash
npm run dev            # 开发服务器
npm run check          # 质量门槛：tsc -b、biome、vitest、vite build（提交前必须通过）
npx vitest run src/features/today   # 只跑某个目录的测试
npm run e2e            # Playwright 端到端（本机 Chrome；先构建再预览）
npm run test:audio     # 声音离线质检（响度、真峰值、咔哒声、接缝）
npm run fonts          # 文案有新字时重新生成字体子集（fonts.test.ts 会提醒）
npm run icons          # 设计稿里的应用图标改了之后重新生成 PNG
npm run shot -- <url> <out.png> phone|desktop [--dark] [--full] [--wait=ms]   # 截图
```

开发钩子（只在开发构建里有）：`?seed=demo` 写入 8 周演示数据；`?speed=20` 让练习加速 20 倍且静音。例：`http://localhost:5173/records?seed=demo`。

开发用页面（不进生产构建，`npm run dev` 后直接打开）：`/ui-kit.html` 全部组件和状态（浅色、深色）；`/audio-lab.html` 试听每种声景、音乐、提示音和钟声，跑离线质检；`/session-lab.html` 用真实声音跑几种练习，检查引擎和声音的接线。

## 5. 一个页面怎样算做完

1. 功能符合 PRODUCT.md 和 APP.md；文案全部来自 `src/content`。
2. 截图对照设计稿：手机（390×844）和桌面（1440×900）、浅色和深色（播放器只有深色），至少两轮「截图 → 对照 → 修改」。字号、字重、间距、颜色、分隔线、图标粗细、对齐都要对上。
3. 键盘走一遍：Tab 顺序合理、焦点可见、弹层能用 Esc 关闭并把焦点还回去。
4. 有 Testing Library 测试（渲染、主要交互、空状态、可读名称），`npm run check` 通过，控制台没有报错。

## 6. 已经做出的决定（不要推翻，除非产品负责人同意）

- v1 不做语音引导，改文字引导；新的一句在 20 秒以上的安静之后出现时有一声很轻的提示音（设置可关）。2026-10-23。
- 慢呼吸默认吸 4.5 秒、呼 6.5 秒（约 5.5 次/分），开头约 90 秒从 8 次/分逐步放慢；范围 4.5–7.0；「有点急」每次加快 0.5 次/分，最多 7.0，并记住。
- 不做连续天数；记录只说练了几天、多少分钟；回神次数中性显示。
- 不提供 4-7-8、Wim Hof 等过度换气法、528 Hz 等（PRODUCT.md §2「不提供」）。
- 响度：放松 −23 LUFS，睡前 −28 LUFS，真峰值 ≤ −3 dBTP。
