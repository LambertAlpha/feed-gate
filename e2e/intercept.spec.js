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

test.describe(() => {
  // 真实 Chrome 开着 bfcache：后退从缓存恢复首页、不发请求，DNR 拦不到，只能靠 onCommitted。
  // 不开的话后退会重新请求首页、被 DNR 拦下，这条用例就测不到 onCommitted
  test.use({ bfcache: true });

  test('被拦后按后退回到首页记录，仍然是闸门', async ({ context, page }) => {
    await serveStub(context, 'https://x.com/notifications');
    await page.goto('https://x.com/notifications');
    await page.evaluate(() => history.pushState({}, '', '/home'));
    await expect(page).toHaveURL(gateUrl('x'));
    // bfcache 恢复不触发 load，只等 commit；之后跳闸门由下面的 URL 断言等待
    await page.goBack({ waitUntil: 'commit' });
    await expect(page).toHaveURL(gateUrl('x'));
  });
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
