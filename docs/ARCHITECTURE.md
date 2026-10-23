# 回神 · 架构

本文件是工程约定。改动模块边界或公共接口时，先改这里。

## 技术栈

| 层 | 选择 | 原因 |
| --- | --- | --- |
| 构建 | Vite 8（Rolldown） | 快；PWA 插件成熟 |
| 界面 | React 19 + TypeScript（strict、`noUncheckedIndexedAccess`） | 主流、类型安全 |
| 路由 | React Router 8（`createBrowserRouter`） | 干净的 URL；离线时由 Service Worker 回退到 `index.html` |
| 状态 | Zustand 5（偏好、记录）；会话引擎自带订阅 | 体积小，React 之外也能用 |
| 存储 | IndexedDB（`idb`）存练习记录；localStorage 存偏好 | 记录可以长期积累；偏好需要同步读取 |
| 声音 | Web Audio API，全部实时合成；重计算放在 Web Worker | 无版权素材、离线可用、体积小 |
| 语音 | Web Speech API（`speechSynthesis`），可关闭 | 用设备自带的中文语音，无需上传 |
| 离线 | vite-plugin-pwa（Workbox，`registerType: 'prompt'`） | 练习中不会被自动更新打断 |
| 测试 | Vitest + Testing Library（jsdom）；Playwright（本机 Chrome） | 单元、组件、端到端 |
| 规范 | Biome（lint + format） | 一个工具，速度快 |

**不依赖任何外部 CDN**：字体在构建时子集化后随应用发布（Google Fonts 在中国大陆不可用）。

## 目录

```
src/
  app/          应用外壳：路由、布局（手机底部标签栏 / 桌面左侧导航）、主题、更新提示、启动
  audio/        声音层：AudioContext 与混音、声景、生成式音乐、钟声、提示音、语音；dsp/ 为纯函数
  content/      纯数据：练习目录、引导词、八周计划、证据、安全文案、声音目录
  data/         持久化与统计：偏好、记录仓库、统计、导出导入、日历提醒（.ics）
  engine/       会话引擎：节拍、引导时间线、时钟、调度、状态机。与 React 无关
  hrv/          心率带（Web Bluetooth）、心率变异指标、共振频率测定
  lib/          通用工具：时间、日期、随机数、节气、格式化
  ui/           设计系统：tokens、基础样式、组件、图标
  features/     各个页面：today、practices、player、records、evidence、settings、onboarding、program、sound、assessment
  test/         测试设置与假实现
docs/
  research/     证据库（evidence.json）、研究报告（RESEARCH.md）、产品参数（app-parameters.md）
  design/       设计规范（DESIGN.md）、最终稿与探索稿
scripts/        构建脚本（字体子集化等）
e2e/            Playwright 端到端测试
reference/      最初的单文件原型（只读参考）
```

## 依赖方向

```
lib ← content ← engine ← features ← app
        ↑         ↑ (端口)
       data     audio、hrv（实现 engine 的端口）
ui ← features
```

- `engine` 只依赖 `content` 的类型和 `lib`，通过 `AudioPort`、`VoicePort`、`PlatformPort` 使用声音和平台能力（见 `src/engine/types.ts`）。测试里用假端口。
- `audio` 实现 `AudioPort`，不了解练习和界面。
- `data` 不依赖 React；React 绑定放在 `data/hooks.ts`。
- `features` 之间不互相导入；共用的东西放到 `ui/` 或对应的层。
- 路径别名 `@/` 指向 `src/`。

## 会话的生命周期

```
idle ──start()──▶ lead（倒数）──▶ running ⇄ paused ──▶ done ──reset()──▶ idle
                                    │
                                    └─ end() 或时间到
```

- 时钟：有声音时以 `AudioContext.currentTime` 为准（暂停即 `suspend`，时间自然停住）；没有声音时用 `performance.now()` 并扣除暂停时长。
- 调度：每 200 ms 前瞻 6 秒（页面在后台时 75 秒）把节拍提示音、背景声起伏、钟声排进音频时间线。逐帧绘制只读 `time()`，不触发 React 渲染。
- 界面订阅 `SessionState`（粗粒度，只在事件时变化），用 `useSyncExternalStore`。
- 结束时引擎发出 `SessionResult`，应用层转成 `SessionRecord` 存入 IndexedDB；不足 1 分钟不记录。

## 声音

- 混音：`master`（安全限幅）←`ambience`、`music`、`cues`（含钟声）。音量曲线为感知线性。
- 声景与音乐的循环素材在 Worker 里用固定种子生成（同一设备上每次一样），主线程只创建 `AudioBuffer`。
- 生成式音乐无节拍或慢速、音量平稳、无人声；跟随节拍的练习里，声景和音乐的亮度随吸呼起伏（见 `docs/research/app-parameters.md`）。
- 语音播报时背景声自动压低。

## 数据与隐私

- 所有数据只在本机；没有账号、没有统计上报。
- 记录可导出为 JSON（完整）或 CSV（表格），可从 JSON 导入（按 id 去重）。
- 偏好在 localStorage，带版本号；读取时逐项校验，非法值回退默认。

## 质量门槛

`npm run check` 必须通过：`tsc -b`、`biome check`、`vitest run`、`vite build`。端到端测试 `npm run e2e` 使用本机 Chrome（`channel: 'chrome'`）。

## 约定

- 文案写在 `content/`，组件里不写长段落；中文使用全角标点，数字与单位之间留空格（如「5 分钟」）。
- 注释用中文，说明「为什么」，不复述代码。
- 颜色、字号、间距只用 `ui/tokens.css` 里的变量。
- 尊重 `prefers-reduced-motion`；所有可点元素至少 44×44 px；键盘可达，焦点可见。
