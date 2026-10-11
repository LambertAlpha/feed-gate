# Feed Gate

打开推特、B站、知乎、小红书首页时，不显示推荐流，先问「你来干什么？」。输入关键词直接跳到站内搜索；下方有消息、通知等功能页入口。没有「随便看看」。

## 安装（Chrome / Arc / Edge / Brave）

1. 打开 `chrome://extensions`，右上角开启「开发者模式」
2. 点「加载已解压的扩展程序」，选择本仓库的 `extension/` 目录
3. 打开该扩展的「详情」，开启「在无痕模式下启用」（扩展无法自行开启；不开的话 Cmd+Shift+N 开无痕窗口就能绕过闸门）
4. 改了代码后，在扩展卡片上点刷新按钮

## 拦截范围

| 站点 | 被拦的首页 |
|---|---|
| 推特 | `x.com/`、`x.com/home` |
| B站 | `www.bilibili.com/` |
| 知乎 | `www.zhihu.com/` |
| 小红书 | `www.xiaohongshu.com/`、`/explore` |

只拦首页。热榜、视频页侧栏推荐等不在范围内，见设计文档。加站点：在 `extension/sites.js` 加一条配置；在 `manifest.json` 的 `host_permissions` 加该站的域名；在 `test/sites.test.js` 补首页和非首页用例（包括那条显式的站点 id 列表）；并更新 `manifest.json` 的 `description`（里面写了四个站名）。

## 已知行为

- 站内点 Logo 回首页时，推荐流可能闪现零点几秒再跳到闸门（单页应用跳转不发请求，只能事后拦）
- 推特网页版有自己的 Service Worker，地址栏直接打开 `x.com` 也可能闪一下，原因同上
- 被拦后按一次后退，会回到进首页之前的页面，不会被困在闸门
- 刷新闸门、或前进后退回到闸门，不计数（只有真正被拦进闸门才 +1）

## 开发

```bash
pnpm install
pnpm exec playwright install chromium   # 新机器只需执行一次，之后才能跑 test:e2e
pnpm test        # 单元测试
pnpm test:e2e    # 端到端（Playwright，强制离线，不需要登录）
pnpm check       # 语法检查
```

设计文档：`docs/superpowers/specs/2026-10-11-feed-gate-design.md`
