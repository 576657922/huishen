# 回神 · 剩余任务

领任务前先读 `AGENTS.md`。每项任务只改它列出的目录；需要别处改动（ui 组件变体、app hook、文案）时，按 AGENTS.md 的规则补在对应位置并在提交说明里写清楚。

状态：⬜ 未开始 · 🟨 进行中 · ✅ 完成

## 已完成的基础（不用再做）

- ✅ 研究证据库 `docs/research/evidence.json`，产品规格、设计规格和 23 张设计稿
- ✅ `src/engine`、`src/audio`、`src/data`、`src/hrv`，有单元测试和声音离线质检
- ✅ `src/content`：16 篇引导词、两个计划、练习目录、安全与求助、声音目录、今日推荐、界面文案、证据卡片
- ✅ `src/ui` 组件库、字体子集、图标；`src/app` 路由、框架、服务、hooks、flows、计划构建；`src/widgets`
- ✅ 引擎和音频的独立评审与修复；四个核心模块在真实浏览器里联调通过（`session-lab.html`、`e2e-audio/session.spec.ts`）；`docs/modules.md`；组件库的设计评审与修复（含 DESIGN.md §12.3 的全部共享组件）。全项目 2016 个单元测试通过。
- ✅ 去掉语音（v1 文字引导）：引擎 `NULL_VOICE`、`captionCue`（新的一句在 20 秒以上的安静之后出现时轻提示）、`SessionState.caption` 带 `t` 和 `dur`（播放器据此让字变淡）、`Timeline.closingT`（结尾的话开始后节拍停止）、慢读时的省略顺序、「有点急」上限 7.0；声音层新增 `caption` 提示音并删除语音朗读；偏好新增 `captionCue`、`bells`、`practice.slow.warmup`、`practice.box.phaseSec`。细节见 `docs/modules.md` 和 `docs/APP.md`。
- ✅ 质量门槛 `npm run check` 全部通过（类型检查、Biome、2037 个单元测试、构建）；声音离线质检通过（`npm run test:audio`）。

所有任务现在都可以开始，建议按 T0 → T1 → T2 … 的顺序；多个人或代理同时做时，各自只改自己任务列出的目录。

## P0 · 页面（按顺序做；每个页面的完成标准见 AGENTS.md §5）

### T0 ✅ 播放器 `/play/:id` 与练习小结（`src/features/player`，并完善 `src/widgets` 里的 DistressSheet、StopGuidance、FeelingChoice、CheckinScale、PreCheckinSheet、SoundPicker）
- 这是最重要的页面，做好后其他页面以它为样板。
- 规格：PRODUCT.md §5–§6；APP.md §7–§9（播放器约定、读哪些 hooks、不舒服？流程、结束流程）；DESIGN.md §8.15（播放器组件和状态）、§13.5–§13.6；设计稿 `player-breath.png`、`player-breath-landscape.png`、`player-focus.png`、`player-guided.png`、`pause.png`、`distress.png`、`distress-200.png`、`summary.png`、`summary-full.png`；文案 `PLAYER`、`SUMMARY`、`GUIDANCE_HOWTO`。
- 各类练习：节拍类（呼吸曲线画布：过去实线带浅填充、将来虚线、「现在」点、段首标「吸 / 再吸 / 停 / 呼」，用 `controller.breathAt(t)` 取点，DPR 适配，60 fps，减少动效时按 DESIGN.md；箱式呼吸用沿正方形走的点；大字相位和本段剩余秒数；轮数、频率；「有点急」→ `stepBack()`，显示新频率，上限 7.0）；专注（时间线上每次回神一道竖线；大的「回神」区，轻点任意处或按空格；**闭眼盲点不能误触结束或暂停**）；数息（左右两个大区「1–8」「9」和「数乱了」，不显示计数）；文字引导类（当前一句是主角，显示到下一句，读完约 6 秒后变淡；段落条；「跳过这一处」→ `skipSection()`；第一次显示怎么练的提示）；静坐计时；听声音（不限时要能结束）。
- 始终可见：暂停、声音（`SoundPicker`，练习中用 `setSound`）、结束（要确认）、不舒服？（打开 DistressSheet：先暂停；60 秒落地练习；求助号码）。Esc 打开暂停面板（含停止指引全文）。声音被浏览器拦下时提示并可重试；iOS 睡前声音的锁屏提示。直接打开 `/play/:id` 没有进行中的练习时显示大的「开始」按钮，不自动开始。
- 小结：时长、对应数据（回神时间线 / 数息数据 / 呼吸轮数和频率）、本周累计、练完感觉（一次点选，写入记录）、开启时的练习后自评（不显示练习前的分数；睡前声音之后不问）、备注、最近多次「更紧张 / 很不舒服」时的温和建议卡、再来一次 / 完成。
- 验收：每种练习用 `?speed=20` 跑完并截图对照设计稿；键盘、读屏名称、减少动效都检查；动画期间 React 不逐帧渲染；单元测试覆盖各类控制、暂停继续结束、不舒服？流程、小结保存。

### T1 ✅ 今日 `/`（`src/features/today`）
- 规格：PRODUCT.md §4；DESIGN.md §13.2；设计稿 `today.png`、`today-dark.png`；文案 `TODAY`（copy.ts）；逻辑 `src/content/today.ts`（`recommend`、`welcomeBack`、`QUICK_PICKS`、`hardMoment`、`dateLine`）。
- 要点：日期和节气；距上次练习 ≥ 3 天时第一行「欢迎回来。先做 1 分钟？」（不显示天数）；主推荐（有计划时先显示计划的今天）带开始和「换一个」；「只有几分钟」；「现在有点难」行打开面板（叹息 1 分钟、呼吸空间应对版、落地练习、求助方式）；本周七个点；手机右上角进设置；桌面布局。没有任何连续天数。
- 验收：`?seed=demo` 下截图与设计稿一致；无记录的新用户也正常；开始按钮能进入播放器。

### T2 ✅ 练习目录 `/practices` 与详情 `/practices/:id`（`src/features/practices`）
- 规格：PRODUCT.md §2；DESIGN.md §13.3–13.4；设计稿 `practices.png`、`practices-full.png`、`detail-slow.png`、`detail-slow-full.png`；内容 `src/content/practices.ts`（`catalogueSections`、`isHidden`、`isOffered`、`evidenceClaims`）、`CATALOGUE`、`DETAIL`。
- 要点：冥想 / 呼吸 / 声音分组，每行有呼吸图形、名称、一句话、默认时长、证据等级；健康检查隐藏的练习要有说明。详情页：介绍、做法、按类型的设置（时长；慢呼吸的节律 4.5–7.0、吸呼比预设、开头 90 秒逐步放慢；箱式呼吸每步 3–6 秒；静坐计时的间隔钟声；节拍提示方式；声音用 `SoundPicker`），写入 `prefs.practice[id]`；证据（每条结论一行带等级，链接到依据页对应卡片）；安全提示；开始栏（`StartButton`）。文字引导类练习显示「怎么练」说明。
- 验收：每个 `isOffered` 的练习 id 都有像样的详情页（写测试遍历）；设置改动后再开始，计划里生效。

### T3 ✅ 记录 `/records`（`src/features/records`）
- 规格：PRODUCT.md §7；DESIGN.md §13.7；设计稿 `records.png`、`records-full.png`、`records-desktop.png`、`records-desktop-full.png`；统计 `src/data` 的 stats（`weekDots`、`monthCalendar`、`practiceBreakdown`、`focusTrend`、`countTrend`、`checkinSummary`）；文案 `RECORDS`。
- 要点：本周天数和分钟；月历点阵（练过的实心，没练的留空，不标红，可翻月）；各练习次数与分钟；专注每 10 分钟回神次数（中性说明）；数息练习数据（≥ 3 次才显示，数乱了单独列）；练习前后自评（≥ 5 次才显示，中位数，±1 视为误差，附说明）；每周压力自评；列表与详情（可删除，二次确认）；导出 JSON / CSV；新用户空状态。
- 验收：`?seed=demo` 截图与设计稿一致；空状态截图；删除和导出有测试。

### T4 ✅ 依据 `/evidence`（`src/features/evidence`）
- 规格：PRODUCT.md §9；DESIGN.md §13.8；设计稿 `evidence.png`、`evidence-full.png`；数据 `src/content/evidence.ts`、`evidence-cards.ts`（按需动态加载，不要进主包）；文案 `EVIDENCE`。
- 要点：方法说明、等级定义、领域筛选、证据卡片（结论 → 效应量与 95% CI → 研究类型、样本、对照 → 等级 → 局限 → 相反证据 → DOI）、「在应用中」链接到练习、「未采用」部分；支持 `/evidence#<id>` 深链接（详情页会链过来）。
- 验收：深链接滚动到卡片并聚焦；主包体积不因证据数据变大（看 `vite build` 的输出）。

### T5 ✅ 设置 `/settings` 与求助 `/help`（`src/features/settings`、`src/features/help`，并完善 `src/widgets/HelpNumbers`）
- 规格：PRODUCT.md §8、§10；DESIGN.md §13.9；文案 `SETTINGS`、`safety.ts`。
- 要点：外观；声音（放松和睡前的默认声音、音量、节拍提示四种方式可试听、钟声、间隔钟声、振动）；文字引导（详细程度、新的一句出现时轻提示）；练习（开头倒数、结尾静默、练习前后自评、每周压力自评）；提醒（「在【…】，我会做【…】；如果【…】，就只做【…】」句式，工作日和周末时间 → 下载 .ics，用 `src/data` 的 ics）；安全（健康情况检查，只存本机，显示会改变什么；停止指引；求助方式；每月自查）；数据（存储方式、导出、导入并显示结果、删除全部二次确认、隐私说明）；关于（免责声明、版本、字体许可）。`/help` 离线可用，号码可点拨。
- 验收：每个开关改动后 prefs 正确保存并影响下一次练习；.ics 文件能被日历导入（RFC 5545，已有单元测试的构建函数）。

### T6 ✅ 首次使用 `/welcome`（`src/features/onboarding`）
- 规格：PRODUCT.md §10；DESIGN.md §13.12；设计稿 `before-start.png`；内容 `FIRST_RUN_NOTICE`、copy 里的 welcome。
- 要点：三行说明回神是什么；「开始之前」须知必须读到底「我已读完」才可点；记录 `prefs.safety.ackOn`、`onboarded`；之后回到用户原本要去的地方（被拦下的开始练习继续）。保持简短。

### T7 ✅ 计划 `/program/:id`（`src/features/program`）
- 规格：PRODUCT.md §3；DESIGN.md §13.10；内容 `src/content/programs`、`PROGRAM`。
- 要点：八周正念、四周呼吸；每周主题、当前周和天（按完成的天数推进，不按日历）；今天的练习带开始（`startPractice({ from: 'program', programDay })`）；每周阅读（约 1 分钟）和提示；5 分钟保底和 20 分钟版本；第 0、4、8 周邀请每周压力自评；加入和退出（确认）；绝不显示「落后」或漏掉的天。

### T8 ✅ 听声音（`src/features/sound`，路由见 APP.md §3）
- 规格：PRODUCT.md §2 声音；DESIGN.md 对应配方；内容 `src/content/sounds.ts`。
- 要点：放松 / 睡前两种模式；声景和音乐分别选择和调音量，可试听；噪声标注「遮蔽环境噪音 · 证据很弱」；时长（放松 10 / 20 / 30；睡前 15 / 30 / 45 / 60 / 不限，选不限要确认）；耳机与音量建议；iOS 锁屏会停声的提示；开始。

### T9 ✅ 舒适节律探索 `/pace-finder`（`src/features/pace-finder`）
- 规格：PRODUCT.md §2；DESIGN.md §13.11；APP.md §8.4（每一档的启动方式和保存方式已经定好）；心率模块 `src/hrv`（`pickByComfort`，实验性的心率带）。
- 要点：说明这是舒适度测试；6.5 → 4.5 次/分五档，每档 1 分钟，每档后 1–5 评轻松度；结果写入慢呼吸节律和 `personalRate`；支持 Web Bluetooth 时才显示「连接心率带（实验）」，带隐私说明；开发时可用模拟器。

## P1 · 联调与验收

- T10 ⬜ 端到端测试 `e2e/flows.spec.ts`（手机和桌面两个项目）：首次使用 → 须知 → 今日；从今日开始 1 分钟练习（开发服务器 + `?speed=30`）→ 小结 → 练完感觉 → 出现在记录里；详情页改节律 → 开始 → 有点急 → 提前结束；专注练习按空格回神；数息点按；身体扫描「跳过这一处」；不舒服？→ 落地练习；听声音开始和停止；设置切换主题、下载提醒、导出 JSON；从详情页深链接到依据；`/help` 离线（构建 + 预览，断网后刷新）。控制台不能有报错。
- T11 ⬜ 设计验收：每个路由在手机和桌面、浅色和深色下截图（`?seed=demo`），逐页对照设计稿和 DESIGN.md 修正。
- T12 ⬜ 无障碍：键盘完整走一遍（DESIGN.md `states.png`）；VoiceOver（iOS Safari）和 TalkBack（Android Chrome）走一遍四种播放器和不舒服？面板；焦点不能落在底部控制栏或标签栏下面（DESIGN.md §11 提到的测试还没写）。
- T13 ⬜ 跨平台检查：Windows（Chrome、Edge）的记录页桌面版，Pixel 和一台小米或华为手机上的今日页（设计稿都是在 PingFang 下渲染的）。
- T14 ⬜ 性能和离线：主包体积、懒加载块、字体总量（目标约 300 KB）；Lighthouse PWA 检查；断网可用。
- T17 ⬜ 节拍在结尾停止后，背景声停在最后的音量上，没有回到自由起伏（只有关掉「结尾静默」时听得出来）；见 `docs/modules.md` §7。
- T18 ✅ 关掉「钟声」时，播放器结尾静默那句文案仍提到「结束钟声」；在 `src/content/copy.ts` 加一个无钟声的版本，播放器按 `plan.bells` 选用。
- T16 ⬜ 小的重复代码：`src/ui/figures/plots.ts` 自己写了 `median` 和 `DAY_MS`，改为从 `src/lib`（`math.ts`、`date.ts`）导入。
- T15 ⬜ 文案剩余的 `TODO(content)`：见 APP.md §12，把 `src/app/strings.ts`、`src/ui/strings.ts`、`src/widgets/SoundPicker` 里的临时常量换成 content 的键。

## P2 · 以后的版本

- 真人录音的语音引导（引导词已按逐句时间线写好；`VoicePort` 接口保留）；有录音后再上线正念行走和睡前身体扫描。
- 不良体验的反馈渠道（需要产品决定和真实联系方式）。
- 研究报告 `docs/research/RESEARCH.md` 和 `app-parameters.md`（证据库已有，报告未写）。
