import { test, expect, gateUrl, serveStub } from './fixtures.js';

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

for (const bfcache of [true, false]) {
  test.describe(() => {
    // 真实 Chrome 开着 bfcache，但缓存可能被驱逐，两种情况都要验证后退不被困在闸门
    test.use({ bfcache });

    test(`被拦后按一次后退回到进首页之前的页面（bfcache ${bfcache ? '开' : '关'}）`, async ({ context, page }) => {
      await serveStub(context, 'https://x.com/notifications');
      await page.goto('https://x.com/notifications');
      await page.evaluate(() => history.pushState({}, '', '/home'));
      await expect(page).toHaveURL(gateUrl('x'));
      // bfcache 恢复不触发 load，只等 commit；之后的 URL 由断言等待
      await page.goBack({ waitUntil: 'commit' });
      await expect(page).toHaveURL('https://x.com/notifications');
      await page.goForward({ waitUntil: 'commit' });
      await expect(page).toHaveURL(gateUrl('x'));
    });
  });
}

// 首页历史记录被替换掉后，后退不再经过首页，onCommitted 需要单独验证：
// 去掉 DNR 规则，让整页加载的首页真正提交，只能靠 onCommitted 拦
test('DNR 规则缺失时，整页加载的首页由 onCommitted 兜底拦下', async ({ context, page }) => {
  const [worker] = context.serviceWorkers();
  await worker.evaluate(() => chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2, 3, 4] }));
  expect(await worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length)).toBe(0);
  await serveStub(context, 'https://www.bilibili.com/');
  await page.goto('https://www.bilibili.com/');
  await expect(page).toHaveURL(gateUrl('bilibili'));
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
