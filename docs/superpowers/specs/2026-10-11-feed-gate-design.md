# Feed Gate 设计文档

日期：2026-10-11

## 问题

在电脑上习惯性打开推特、B站、知乎、小红书首页，被算法推荐流吸走注意力。分心的入口是「打开首页」这个习惯动作，而不是看内容过程中被侧栏带走——所以只处理首页，不碰站内其他页面。

## 目标

- 打开四个站的首页时，不显示推荐流，而是显示一个「你来干什么？」闸门页
- 有明确目的时成本接近零：在闸门里输入的关键词，本来就要在站内搜索框里输
- 漫无目的地打开时，没有任何办法进入推荐流（不留后门）

## 非目标

- 暂停开关、popup、设置页、图标美化
- 非首页的推荐位：B站视频页右侧推荐和自动连播、知乎回答页底部推荐、推特 Trends、B站 `/v/popular`、知乎 `/hot`、推特 `/explore`
- Safari、Firefox；只支持 Chrome 系（Chrome / Arc / Edge / Brave）
- 手机 App

## 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 范围 | 只拦首页 | 用户确认分心来自习惯性打开首页（入口问题） |
| 首页替换为 | 意图闸门 | 比重定向到关注流更直接地打断习惯回路 |
| 「随便看看」后门 | 不提供 | 用户选择硬拦截 |
| 闸门快捷入口 | 只放功能页（消息/通知/收藏） | 有事办能直达，避免因为不便而关掉插件；不放任何信息流 |

**已知风险**：没有后门，而在 `chrome://extensions` 关掉插件只要两秒。如果使用中发现自己去关插件，信号是需要加「暂停 1 小时、自动恢复」，而不是硬扛。本期不做。

## 用户可见行为

### 闸门页

- 标题：「你来 {站名} 干什么？」，输入框自动聚焦
- 输入关键词 + 回车 → `location.replace()` 跳到该站搜索结果页（用 replace，按后退不会回到闸门）
- 输入为空或只有空白时回车：不跳转
- 输入框下方：该站功能页快捷入口（2–4 个）
- 角落：「今天第 N 次打开 {站名} 首页 · 四站合计 M 次」；按本地日期，次日清零
- 每次打开闸门页计数 +1

### 站点配置

| 站点 id | 站名 | 拦截的首页 | 搜索跳转 |
|---|---|---|---|
| `x` | 推特 | `x.com/`、`x.com/home`（含 `twitter.com` 同路径） | `https://x.com/search?q={q}` |
| `bilibili` | B站 | `www.bilibili.com/`（含查询参数，如 `/?spm_id_from=…`） | `https://search.bilibili.com/all?keyword={q}` |
| `zhihu` | 知乎 | `www.zhihu.com/` | `https://www.zhihu.com/search?type=content&q={q}` |
| `xiaohongshu` | 小红书 | `www.xiaohongshu.com/`、`/explore`、`/explore?channel_id=…` | `https://www.xiaohongshu.com/search_result?keyword={q}` |

裸域（无 `www`）同样拦截。`{q}` 用 `encodeURIComponent` 编码。

**关键边界**：小红书笔记详情页是 `/explore/<笔记ID>`，必须**不拦**；B站 `/video/BV…`、推特 `/search`、`/<用户名>` 都必须不拦。

### 快捷入口候选

实现时逐个在浏览器里验证路径有效（未登录时至少能跳到登录页），验证不过的删掉，不保留猜测的链接。

- 推特：通知 `/notifications`、私信 `/messages`、书签 `/i/bookmarks`
- B站：消息 `message.bilibili.com`、稍后再看、历史记录
- 知乎：通知 `/notifications`、私信 `/messages`、收藏
- 小红书：通知 `/notification`

## 架构

```
feed-gate/
├── extension/          ← Chrome「加载已解压的扩展程序」选这个目录
│   ├── manifest.json   MV3；权限 declarativeNetRequest、webNavigation、scripting、storage；只申请四站 host 权限
│   ├── sites.js        唯一配置源：id、站名、域名、首页正则、搜索前缀、快捷入口
│   ├── rules.js        由 sites.js 生成 DNR 规则（纯函数）
│   ├── stats.js        每日计数（纯函数）
│   ├── background.js   安装规则 + 监听站内跳转兜底
│   ├── gate.html
│   ├── gate.js
│   └── gate.css
├── test/               node --test 单元测试
├── e2e/                Playwright 端到端
└── package.json        "type": "module" 和测试脚本（不进扩展目录）
```

扩展代码单独放在 `extension/`，避免把 `node_modules` 一起加载进 Chrome。无构建步骤，原生 ES Module：service worker 用 `"type": "module"`，`gate.js` 也是 module，它们和测试都直接 import `sites.js`。

### 三层拦截

进入首页有三条路径，各用一种手段拦。三层都是**替换**当前历史记录，而不是新增一条：

| 进入方式 | 手段 | 效果 |
|---|---|---|
| 地址栏输入、外链、刷新（整页加载） | `declarativeNetRequest` 动态规则，`main_frame` 请求重定向到 `gate.html?site={id}` | 请求发出前就被改走，首页零加载、不闪 |
| 站内点 Logo /「发现」（SPA `pushState`，不发请求） | `webNavigation.onHistoryStateUpdated` → `scripting.executeScript` 在页面里执行 `location.replace(闸门)` | 推荐流可能闪现零点几秒 |
| DNR 规则缺失时的整页加载、bfcache 恢复出的首页 | `webNavigation.onCommitted` → 同上 | 同上 |

两个 webNavigation 监听只处理 `frameId === 0`（主框架），并用 `hostEquals` 过滤器限定在四站域名，避免其他网站的每次跳转都唤醒 service worker。`executeScript` 失败时退回 `chrome.tabs.update`。

**为什么必须替换**：最初设计用 `chrome.tabs.update` 跳闸门，会新压一条历史记录，首页那条还留着。实测在真实 Chrome（默认开 bfcache）里，按后退时首页从缓存恢复，被 `onCommitted` 再拦一次，又压一条闸门，后退按钮被永久困住。改成 `location.replace` 后，历史里首页那条被闸门替换，按一次后退就回到进首页之前的页面，前进回到闸门。

### 单一配置源

每个站的首页正则只在 `sites.js` 写一份，同时供给 DNR 的 `regexFilter`（RE2 语法）和 JS 的 `RegExp`。因此正则只能用两者共同支持的子集：不用前瞻/后顾、不用反向引用、仅 ASCII。DNR 规则设 `isUrlFilterCaseSensitive: true`，和 JS `RegExp` 的大小写行为一致。单元测试会用 JS `RegExp` 跑同一个字符串，端到端测试验证 DNR 实际接受这些正则。

DNR 规则在 `runtime.onInstalled` 和 `runtime.onStartup` 时重建：先删除本扩展全部动态规则，再按 `sites.js` 生成。每站一条规则，rule id 按站点顺序从 1 开始。动态规则会跨浏览器重启和扩展升级保留，重建是幂等的。

### Manifest 约束（来自 Chrome 文档）

- DNR 重定向到扩展内页面时，目标必须在 `web_accessible_resources` 中声明。`matches` 用 `<all_urls>` 而不是四站域名：从 Google 搜索结果等其他网站点链接进首页时，请求的发起方是那个网站，只写四站会导致重定向被拒（`ERR_BLOCKED_BY_CLIENT`）
- 重定向规则需要对应站点的 host 权限，因此 `host_permissions` 列出四站（含裸域）
- 在页面里执行 `location.replace` 需要 `scripting` 权限；四站 host 权限已有，安装提示不变。网页能跳转到 `gate.html`，同样依赖它在 `web_accessible_resources` 里
- 兜底用的 `chrome.tabs.update` 不需要 `tabs` 权限

### 数据

`chrome.storage.local` 中一个键：

```json
{ "stats": { "date": "2026-10-11", "counts": { "x": 2, "bilibili": 1 } } }
```

读取时若 `date` 不是今天（本地时区），视为空并覆盖。不保留历史。

## 错误处理

- `gate.html` 收到未知或缺失的 `site` 参数：显示通用标题「你来这里干什么？」，不显示搜索和快捷入口，计数不变
- `chrome.storage` 读写失败：闸门照常工作，只是不显示计数（不能因为统计挂掉而放行）

## 测试

1. **单元测试**（`node --test`，零依赖）：URL 表驱动，覆盖每站的正例和反例，重点是上面的「关键边界」；另测搜索 URL 编码（中文、空格、`&`）和日期翻转后计数清零的纯函数
2. **端到端**（Playwright 自带的 Chromium，`--load-extension` 加载）。非首页的站点页面和搜索结果页都用 `context.route` 返回本地桩页面；浏览器用 `--host-resolver-rules` 强制离线，否则 DNR 失效时真实首页加载后会被 `onCommitted` 兜底拦下，测试照过、掩盖问题：
   - 四站各一次：打开首页 URL → 落到 `gate.html` → 输入关键词回车 → URL 变为搜索页 → 按后退不回闸门
   - SPA 兜底：先打开某站非首页页面，`page.evaluate(() => history.pushState({}, '', '/'))`（推特用 `/home`，小红书用 `/explore`），断言跳到闸门
   - 后退：被拦后按一次后退回到进首页之前的页面，前进回到闸门；bfcache 开、关各跑一次（Playwright 默认关 bfcache，真实 Chrome 默认开）
   - `onCommitted` 兜底：删掉全部 DNR 规则后打开首页，断言仍跳到闸门
   - 变异检查：去掉三层中任意一层，都至少有一个用例失败
   - 跨站点击：从 `example.com` 点链接进 B站首页，断言跳到闸门（验证 `<all_urls>` 的必要性）
   - 反例：小红书 `/explore/<笔记ID>`、B站视频页、推特搜索页，断言**没有**跳到闸门
   - 闸门页：空输入不跳转、计数文案、未知 `site` 参数、快捷入口
3. **手动**（用户在自己已登录的 Chrome 里）：加载解包扩展，点一遍每站快捷入口，确认能到对应页面
