# T0 播放器验收

已完成各类播放器、暂停／声音／结束确认／不舒服面板、练习小结和保存。`npm run check` 通过：114 个文件、2051 项测试，类型检查、Biome、构建通过。
- `round1-*` 为减少动效下的第一轮截图；`round2-*` 为正常动效的第二轮；`round3-slow-*` 修正了呼吸图被全局 canvas 最大宽度限制的问题。均包含手机、桌面与横屏。
- 对照 `docs/design/final/player-*.png`、`pause.png`、`distress.png`、`summary*.png` 核对。运行中时刻、声音、练习时长以实际数据为准；系统状态栏不在网页内仿造。
- `complete.json`：慢呼吸、箱式、专注、数息、身体扫描、计时、叹息、放松声音、睡前声音和落地练习，全部用 `?speed=20` 跑完。小结截图为 `complete-*-summary.png`。
- 专注练习的回神、感觉、练前／练后自评、备注，通过导出的真实 IndexedDB 记录验证。测试等待“完成”保存并回到今日后再读取，避免强制导航中断数据库事务。
- `summary-{phone,desktop}-{light,dark}.png`：四种布局与主题的小结；完成按钮单独固定在底栏，再来一次放在正文末尾。
- `distress-200.png`、`after-unwell.png`：大字号正文可滚动，底部操作可见；不舒服 → 落地 → 仅问练完感觉 → 很不舒服 → 先休息和求助流程通过。
- 空格回神不会误按当前聚焦的暂停或结束按钮；结束仍有确认。Esc 暂停、暂停面板 Esc 继续；不舒服面板 Esc 仅回到暂停面板。

为使页面只使用公开接口，补充了 `SessionState.timeline`（实际、已扣除跳过时间的时间线）、`retryAudio()`（重新解锁并接回声音时钟，保留进度）；公共对话框增加播放器深色表面，TextField 增加失焦保存回调。相关回归测试通过。新增 `widgets/SessionStage` 供 T9 共用，逐帧只在 canvas 绘图，React 读数只按秒更新。

复现：先 `npm run dev -- --host 127.0.0.1`，再运行本目录的 `capture.mjs`、`complete.mjs`、`distress.mjs` 和 `summary.mjs`。浏览器检查均使用独立上下文，没有修改用户的浏览器资料。
