# 首页自然配图

2026年10月24日，按产品负责人给出的[原型图片](https://chatgpt.com/s/m_6adc1f4d2c70819189560a9da88b50ad)为首页加入摄影配图。只更新首页的呈现，播放器及练习流程沿用现有实现。

## 设计和素材

- 主推荐：山湖照片，原有标题、证据等级、练习图形和开始入口保留；以现有深色 token 和暗色遮罩保证可读性。
- 三个短练习：水面、树影、山湖缩略图，名称、时长、健康情况筛选均来自原内容。整张入口可点，键盘可访问；图片是装饰，不加入读屏名称。
- 素材由内置 `image_gen` 生成，使用已有的 Sharp 运行时转换为 WebP，没有新增项目依赖。
- 图片保存在 `src/features/today/images/`：`lake-1536.webp`（1536 × 1024）、`lake-960.webp`（960 × 640）、`water-540.webp` 和 `leaves-540.webp`（540 × 720）。合计约 220 KB；主图使用响应式源，所有图片参与 PWA 预缓存，无第三方图片请求。

## 验收

- 完成两轮首页截图对照；复查 390 × 844 手机、1440 × 900 桌面，以及浅色和深色外观。手机入口收简为名称与时长，避免结构短句断行零碎。
- 键盘从「换一个」经过开始按钮到配图入口，顺序正确且焦点框可见；仅在首页验证，没有修改播放器。
- 首页未捕获控制台错误。已还原 Chrome 的设备和深色媒体查询模拟，网络无节流。
- Node.js `24.18.0` 下 `VITEST_MAX_WORKERS=2 npm run check` 通过：120 个测试文件、2074 项测试，类型、Biome、生产构建均通过。PWA 预缓存 69 项，包含 4 个 WebP 文件。
- 实际截图保存在 `src/features/today/__checks__/photos-*.png`（本地验收文件，不提交到仓库）。

## 最终生成提示词

### 山湖

Use case: photorealistic-natural. Asset type: a high resolution 3:2 landscape photograph used as the full background of a Chinese meditation PWA's main recommendation. Primary request: quiet lake with layered dark mountains and a distant forested shoreline, a pale warm early morning sky, delicate horizontal ripples. Restrained editorial travel photography, tangible fine detail, muted charcoal green, warm grey and soft ivory, subtle natural light, realistic dynamic range. Composition: horizon near upper third, dark mountains across left and center, open quiet water in lower half, landscape fills the whole frame, suitable for horizontal and portrait crops. Premium calm photographic quality, no fantasy, no buildings, no people, no boats, no stacked stones, no lotus. No text, no typography, no UI, no frame, no logos, no watermark. Generate only the photograph.

### 水面

Use case: photorealistic-natural. Asset type: high resolution portrait editorial photograph for a small meditation practice cover. Primary request: a close view of a quiet lake's surface with slow broad ripples and soft reflected morning light, no visible horizon. Muted silver, warm grey and restrained deep green, tactile natural water detail, understated photographic realism. Composition: edge-to-edge rippling water, gentle diagonal light, tonal midtones, no spectacular sun flare. No objects, no people, no sky, no text, no UI, no logos, no frame, no watermark. Generate only the photograph, portrait 3:4.

### 树影

Use case: photorealistic-natural. Asset type: high resolution portrait editorial photograph for a small meditation practice cover. Primary request: a few natural olive-green leaves near a warm off-white plaster wall, dappled window sunlight and delicate leaf shadows. Quiet ordinary domestic detail, tactile plaster, soft subdued warm grey and faded natural green, premium editorial still life photograph, realistic lens softness and precise leaf detail. Composition: leaves in upper and right parts, empty soft wall and shadow through center and lower part, no pot visible, no furniture, no people. No text, no typography, no UI, no logos, no frame, no watermark. Generate only the photograph, portrait 3:4.
