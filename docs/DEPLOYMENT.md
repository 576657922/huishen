# 回神 · 部署

正式地址：`https://huishen.chinnhouhou.com`，正在配置 DNS 与 HTTPS。

腾讯云中国站项目：`makers-1v3cgnr1pqq0`，项目名 `huishen`。
加速区域：全球可用区（不含中国大陆）。
首个生产部署 `dp945ym2t3xz` 已成功，对应提交 `5ef5b89`。
平台地址：`https://huishen-cpyy7psl.edgeone.dev`，正式分享使用自定义域名。

源码仓库：<https://github.com/576657922/huishen>。
面向国内访客使用腾讯云 EdgeOne Pages，GitHub 只负责保存源码。

## 构建和托管

仓库根目录的 `edgeone.json` 配置安装、构建、Node.js 版本、单页应用路由回退及缓存。

- 安装：`npm ci`。
- 构建：`npm run build`，输出目录 `dist`。
- Node.js：`26.7.0`，与通过完整质量检查的本机版本一致，也满足 React Router、jsdom 等依赖的版本要求。
- 正式分支：`main`。
- 数据库、服务器端函数、环境变量：不需要。

发布前执行 `VITEST_MAX_WORKERS=2 npm run check`。导入 GitHub 仓库时选择 Vite，并核对控制台读取了以上配置。
也可上传已构建的 `dist`，同时保留根目录的 `edgeone.json` 配置；上传方式需要单独确认平台已启用 SPA 路由回退。

`/* → /index.html` 是 EdgeOne 官方支持的 SPA 回退形式，静态资源优先匹配。
因此直接访问或刷新 `/practices/slow`、`/help`、`/play/focus` 仍由应用处理。
字体、图标和声音处理代码都随应用托管，没有 Google Fonts 或其他外部运行时依赖。

## 域名

只新增 `huishen.chinnhouhou.com`，保留根域名和原网站的 DNS 记录。
在 EdgeOne 添加该子域名后，按平台实际返回的值配置 CNAME、域名验证及 HTTPS 证书，不预填或猜测 CNAME。

根据域名的实际备案情况选择加速区域。未经核实，不选择需要备案的中国大陆节点。
平台默认域名在国内有预览链接有效期限制，正式分享使用自定义域名。

不同网址的本机记录相互独立；从 localhost 或临时网址切换到正式域名前，可在设置中导出 JSON，再到正式地址导入。

## 发布验收

1. 确认部署状态成功、证书有效，并记录实际发布 URL 和 Git commit。
2. 在手机和桌面打开正式网址，完成首次使用，开始、暂停、结束练习。
3. 直接打开并刷新详情、设置、播放器和依据锚点，检查脚本、字体、AudioWorklet 资源无错误。
4. 等待离线资源缓存完成后断网刷新 `/help`，确认仍可使用。
5. 使用国内电信、联通、移动线路检查正式域名；海外本机访问成功不能代替国内线路验收。
6. 推送一次后续提交，确认自动构建和部署触发。

## 官方参考

- [导入 Git 仓库](https://pages.edgeone.ai/document/importing-a-git-repository)
- [edgeone.json 与 SPA 路由](https://pages.edgeone.ai/document/edgeone-json)
- [域名与加速区域](https://pages.edgeone.ai/document/domain-overview)
- [构建配置与 Node.js 版本](https://pages.edgeone.ai/document/edgeone-json)
