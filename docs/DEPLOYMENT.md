# 回神 · 部署

正式地址：<https://huishen.chinnhouhou.com>，已公开上线，HTTPS 已生效。

腾讯云中国站项目：`makers-1v3cgnr1pqq0`，项目名 `huishen`。
加速区域：全球可用区（不含中国大陆）。
应用版本提交 `8173256`，生产部署 `dp1un3to6sqa` 已成功（2026年10月24日）。
后续部署说明与响应头调整不改变应用代码。
平台地址：`https://huishen-cpyy7psl.edgeone.dev`，正式分享使用自定义域名。

源码仓库：<https://github.com/576657922/huishen>。
面向国内访客使用腾讯云 EdgeOne Pages，GitHub 只负责保存源码。

## 构建和托管

仓库根目录的 `edgeone.json` 配置安装、构建、Node.js 版本、单页应用路由回退及缓存。

- 安装：`npm ci`。
- 构建：`npm run build`，输出目录 `dist`。
- Node.js：`24.18.0`，已在平台控制台核实支持，满足 React Router、jsdom 等依赖的版本要求。
- 正式分支：`main`。
- 推送 `main` 自动部署已开启并实测成功，预览分支自动部署关闭。
- 数据库、服务器端函数、环境变量：不需要。

发布前执行 `VITEST_MAX_WORKERS=2 npm run check`。导入 GitHub 仓库时选择 Vite，并核对控制台读取了以上配置。
也可上传已构建的 `dist`，同时保留根目录的 `edgeone.json` 配置；上传方式需要单独确认平台已启用 SPA 路由回退。

`/* → /index.html` 是 EdgeOne 官方支持的 SPA 回退形式，静态资源优先匹配。
因此直接访问或刷新 `/practices/slow`、`/help`、`/play/focus` 仍由应用处理。
字体、图标和声音处理代码都随应用托管，没有 Google Fonts 或其他外部运行时依赖。

## 域名

域名在 Northwest Registered Agent 管理。只新增以下记录，根域名、`www` 原网站及邮件记录均保留：

| 类型 | 主机记录 | 值 |
| --- | --- | --- |
| CNAME | `huishen` | `huishen.chinnhouhou.com.pages.dnsoe6.com.` |
| TXT | `edgeonereclaim.huishen` | `reclaim-dcv371pqny20z0gn2ynukuprnpgeq6ls` |

EdgeOne 已显示域名「已生效」、HTTPS 证书「已部署」。
免费证书自动续期，开启 HTTP → HTTPS 的 302 跳转。
已通过正式域名的严格 TLS 证书校验；验证时没有跳过证书检查。

根据域名的实际备案情况选择加速区域。未经核实，不选择需要备案的中国大陆节点。
平台默认域名在国内有预览链接有效期限制，正式分享使用自定义域名。

不同网址的本机记录相互独立；从 localhost 或临时网址切换到正式域名前，可在设置中导出 JSON，再到正式地址导入。

## 本次发布验收

- 在 Node.js `24.18.0` 下执行 `VITEST_MAX_WORKERS=2 npm run check`：TypeScript、Biome、120 个测试文件的 2074 项测试及生产构建通过。
- 已部署平台地址完成首页桌面与 390 × 844 手机视口检查，以及首次使用、慢呼吸开始／暂停／结束、安全提示和求助页检查；未捕获应用错误。
- 在 Chrome 开发工具中切为 Offline 后刷新 `/help`，页面仍完整可用；已恢复正常联网。
- 正式域名首页、详情、求助、设置、播放器、依据等路由及脚本、样式、字体、图标、Service Worker、manifest 共 17 项 HTTP 检查均返回 200，证书校验通过。
- HTTP 请求返回 302，目标为同路径 HTTPS。
- 权威 DNS 和公共 DNS 已解析；发布初期本机运营商 DNS 仍有旧的否定缓存，等待自然过期，没有修改系统 DNS 设置。

### 国内线路抽测

2026年10月24日使用 ITDOG 测试 `http://huishen.chinnhouhou.com/`，包含一次重定向，成功节点最终返回 200。
324 个节点（含港澳台）中 313 个成功、11 个失败。三家运营商均存在成功线路，成功节点平均总耗时：

| 运营商 | 平均总耗时 |
| --- | --- |
| 中国电信 | 1.819 秒 |
| 中国联通 | 2.322 秒 |
| 中国移动 | 2.088 秒 |

失败节点分布于福建、黑龙江、吉林、内蒙古、广东、广西、河北，其中 1 个为 DNS 解析失败。
该结果是发布时的 HTTP 可达性抽测，不代表完整页面加载耗时，也不保证所有地区长期可用。

## 后续发布检查

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
