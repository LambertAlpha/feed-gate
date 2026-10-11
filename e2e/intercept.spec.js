import { test, expect, gateUrl, serveStub } from './fixtures.js';
import { SITES } from '../extension/sites.js';

const HOMES = [
  { id: 'x', url: 'https://x.com/home' },
  { id: 'bilibili', url: 'https://www.bilibili.com/' },
  { id: 'zhihu', url: 'https://www.zhihu.com/' },
  { id: 'xiaohongshu', url: 'https://www.xiaohongshu.com/explore' },
];

for (const { id, url } of HOMES) {
  test(`${id}：直接打开首页被重定向到闸门`, async ({ page }) => {
    await page.goto(url);
    await expect(page).toHaveURL(gateUrl(id));
  });
}

const SPA = [
  { id: 'x', from: 'https://x.com/notifications', to: '/home' },
  { id: 'bilibili', from: 'https://www.bilibili.com/video/BV1GJ411x7h7', to: '/' },
  { id: 'zhihu', from: 'https://www.zhihu.com/question/19550225', to: '/' },
  { id: 'xiaohongshu', from: 'https://www.xiaohongshu.com/search_result?keyword=a', to: '/explore' },
];

for (const { id, from, to } of SPA) {
  test(`${id}：站内 pushState 回首页被拦`, async ({ context, page }) => {
    await serveStub(context, from);
    await page.goto(from);
    await page.evaluate((path) => history.pushState({}, '', path), to);
    await expect(page).toHaveURL(gateUrl(id));
  });
}

test.describe(() => {
  // 按真实 Chrome 的设置开着 bfcache。闸门用 location.replace 替换了首页那条历史记录，
  // 首页文档被丢弃，后退不会从 bfcache 恢复首页；这条用例验证的是历史记录被替换
  test.use({ bfcache: true });

  test('站内跳首页被拦后，后退回到进首页之前的页面，前进回到闸门', async ({ context, page }) => {
    await serveStub(context, 'https://x.com/notifications');
    await page.goto('https://x.com/notifications');
    await page.evaluate(() => history.pushState({}, '', '/home'));
    await expect(page).toHaveURL(gateUrl('x'));
    // 开着 bfcache 时目标页可能从缓存恢复、不触发 load，所以只等 commit，URL 由断言等待
    await page.goBack({ waitUntil: 'commit' });
    await expect(page).toHaveURL('https://x.com/notifications');
    await page.goForward({ waitUntil: 'commit' });
    await expect(page).toHaveURL(gateUrl('x'));
  });
});

// 去掉 DNR 规则，模拟 DNR 看不到的整页加载（如网站 service worker 应答的导航）：
// 首页真正提交，只能靠 onCommitted 拦，而且也要替换历史记录，后退不能被困
test('DNR 看不到的整页加载由 onCommitted 拦下，后退回到进首页之前的页面', async ({ context, page }) => {
  const [worker] = context.serviceWorkers();
  // 规则 id 按站点顺序从 1 开始（见 rules.js）；删漏了的话下面的 length 断言会失败
  const ruleIds = SITES.map((_, i) => i + 1);
  await worker.evaluate((removeRuleIds) => chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds }), ruleIds);
  expect(await worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length)).toBe(0);
  await serveStub(context, 'https://example.com/');
  await serveStub(context, 'https://www.bilibili.com/');
  await page.goto('https://example.com/');
  await page.goto('https://www.bilibili.com/');
  await expect(page).toHaveURL(gateUrl('bilibili'));
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL('https://example.com/');
});

test('从其他网站点链接进首页也被拦', async ({ context, page }) => {
  await serveStub(context, 'https://example.com/', '<a id="go" href="https://www.bilibili.com/">go</a>');
  await page.goto('https://example.com/');
  await page.click('#go');
  await expect(page).toHaveURL(gateUrl('bilibili'));
});

const NOT_GATED = [
  'https://www.xiaohongshu.com/explore/64f1a2b3c4d5e6f7a8b9c0d1',
  'https://www.bilibili.com/video/BV1GJ411x7h7',
  'https://x.com/search?q=claude',
];

for (const url of NOT_GATED) {
  test(`不拦：${url}`, async ({ context, page }) => {
    await serveStub(context, url);
    await page.goto(url);
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(url);
  });
}
