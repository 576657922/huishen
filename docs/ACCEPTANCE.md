# T0–T9 页面验收 · 2026年10月24日

T0–T9 已完成。以播放器作为其他页面的实现样板，依次完成页面、运行 `npm run check`、截图对照和修正。验收素材保存在各页面的 `__checks__/`，原设计稿仍在 `docs/design/final/`。下面以当前版本为准，替代早期临时锁定期间的交接说明。

## 逐项结果

| 任务 | 功能与重点验证 | 检查日志与截图 |
| --- | --- | --- |
| T0 播放器与小结 | 呼吸、箱式、专注、数息、文字引导、计时、声音、落地；暂停／继续／声音／结束／不舒服；小结感觉、自评、备注及保存 | `src/features/player/__checks__/check.log`；`HANDOFF.md`；`round1-*`、`round2-*`、`round3-slow-*`、`summary-*`、`complete-*-summary.png` |
| T1 今日 | 时段与计划推荐、换一个、快捷练习、难受时出口、欢迎回来、本周；无记录状态 | `src/features/today/__checks__/check.log`；`today-{phone,desktop}-{light,dark}.png` |
| T2 目录与详情 | v1 练习筛选、健康检查、详情、设置、证据；热身及箱式秒数持久化，重载后实际计划生效；慢呼吸上限 7.0 | `src/features/practices/__checks__/check.log`；`practices-*`；`persistence.mjs`、`box-saved-six-seconds.png` |
| T3 记录 | 统计门槛、月历、历史与详情、删除确认及撤销、JSON／CSV、空状态 | `src/features/records/__checks__/check.log`；`records-*`、`empty-records-*`、`full-records-*` |
| T4 依据 | 方法、等级、筛选、结论、区间、局限、相反证据、来源、在应用中与未采用；深链接滚动并聚焦 | `src/features/evidence/__checks__/check.log`；`evidence-*`、`full-evidence-*` |
| T5 设置与求助 | 全部偏好；四种节拍试听；提醒句式与 .ics；本机健康检查、每月自查；导入合并及重复跳过；两次删除确认；隐私、免责声明、字体许可；离线求助 | `src/features/settings/__checks__/check.log`；`t5-round*`、`t5-additional*`；`t5-flow.json`、`reminder.ics`、`help-offline.png`、`offline.log` |
| T6 首次使用 | 读到底才允许确认；Esc 不绕过门槛；200% 字号；恢复被拦下的普通练习及舒适节律探索 | `src/features/onboarding/__checks__/check.log`；`t6-current-*`、`t6-current2-*` |
| T7 计划 | 两套计划、加入／退出／重置、按完成天数推进、周阅读、保底／长版、压力自评；第 7 周两段练习正确计天 | `src/features/program/__checks__/check.log`；`t7-current1-full-*`、`t7-current2-*` |
| T8 听声音 | 放松／睡前、独立声音组合与音量、试听、时长、不限时确认、睡前隐藏鸟鸣、耳机与安全说明、iOS 提示 | `src/features/sound/__checks__/check.log`；`t8-round1-full-*`、`t8-round3-*`、`t8-final-full-*`、`t8-unlimited-confirm.png`、`t8-flow.json` |
| T9 舒适节律探索 | 五档各一分钟、不可跳过的评分、600 ms 反馈、同分选择、结果应用／不用了、合并单条记录、中途退出；可选心率带、断连与离开释放、开发模拟器 | `src/features/pace-finder/__checks__/check.log`；`t9-round1-full-*`、`t9-round3-*`、`final-full-*`、`t9-current-*-run.png`、`*-rating.png`、`*-result.png`；`t9-flow.json`、`t9-gate.json`、`t9-layouts.json` |

各项均运行过完整质量门槛。早期 T0–T4 的检查为 2051 项测试，T6–T7 为 2059 项，T8 为 2062 项；最后补充设置试听及心率带测试后，T5 的检查为 **120 个测试文件、2073 项测试通过**；T9 补充重连取消测试后，最终为 **120 个测试文件、2074 项测试通过**，包括 TypeScript、Biome、Vitest 和生产构建。最终检查用 `VITEST_MAX_WORKERS=2 npm run check` 限制并行度，减少本机负载对音频 50 ms 性能门槛的干扰，未放宽测试阈值。

## 截图与真实浏览器验证

- 手机 390 × 844、桌面 1440 × 900，浅色和深色；播放器始终深色，另验横屏与减少动效。每页经历至少两轮截图核对，修正后的图与最初轮次一同保留。
- 有设计稿的页面逐项对照 `today`、`practices`、`detail-slow`、`records`、`evidence`、`before-start`、`player-*`、`pause`、`distress`、`summary*`。设置、计划、声音与节律探索按 DESIGN.md §13 配方和相邻设计稿实现。系统状态栏不在网页内仿造；日期、时长及演示记录以真实运行数据为准。
- 截图修正包括：播放器画布宽度、小结底栏、长标题换行、手机依据等级排版、说明段落间距、节律评分字号及步骤编号。早期截图中的错误以之后轮次为准。
- T0 用 `?speed=20` 实际完成十类练习，并验证 IndexedDB 中的感觉、自评及备注。空格回神不会误按当前聚焦的暂停或结束；不舒服 → 落地 → 休息与求助流程通过。
- 最终 22 项主要路由／设备组合通过单一 h1、无横向溢出与键盘 Tab 检查，结果在 `src/features/player/__checks__/final-keyboard.json`。整页截图中的固定底栏仍处于原视口底部，实际滚动时持续停靠，正文保留底部空白。
- T5 实际下载 .ics 和 JSON，重新导入备份、跳过已有记录，取消第二次删除。生产预览的 `/help` 在断网后刷新仍可显示全文和拨号链接。
- T8 不限时选择必须确认，实际开始、结束及小结完成通过。
- T9 四种布局均实际跑完五档；评分时分别截取两张 canvas，确认画面保持静止；只保存一条 300 秒记录。建议按轻松度选择，只有点应用才改变慢呼吸偏好。须知返回、模拟心率带与 60 秒中途结束均通过；原始逐搏数据不写入记录。
- 新增文案统一放在 `src/content`；补齐字体子集，字体许可随应用打包。证据卡片仍为独立懒加载块，未将完整研究库并入主包。

## 必要的共享改动

- `widgets/SessionStage` 提供共用的呼吸画布、字幕与节拍舞台；逐帧绘画读 `useSessionClock`，React 读数按秒更新。T9 评分时可以冻结画布。
- 引擎公开实际时间线 `SessionState.timeline` 和声音重试 `retryAudio()`，保留练习进度并恢复音频时钟；相关测试及 APP.md、modules.md 已更新。
- 通用对话框支持播放器深色表面；TextField 支持失焦保存；SectionHead 支持长标题换行。
- 记录导出放到 `app/flows/backup.ts`，供记录和设置共同使用，页面之间不互相导入。
- 首次须知记录原入口，使舒适节律探索确认后返回自己的页面。播放器按钟声开关选择结尾文案，顺带完成 T18。

## 总体验收边界

`TASKS.md` 的 P1 总体验收仍单独保留。已完成本机 Chrome 页面与交互验证；未声称完成 iOS VoiceOver、Android TalkBack、真实蓝牙硬件或 Windows／Android 实机验收。T10–T17 中未完成的项目继续按原任务卡推进。
