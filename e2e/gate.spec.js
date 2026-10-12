import { test, expect, gateUrl, serveStub } from './fixtures.js';

const QUERY = '测试 a&b';

const SITES = [
  { id: 'x', name: 'X', home: 'https://x.com/home', searchPrefix: 'https://x.com/search?q=' },
  { id: 'bilibili', name: 'Bilibili', home: 'https://www.bilibili.com/', searchPrefix: 'https://search.bilibili.com/all?keyword=' },
  { id: 'zhihu', name: 'Zhihu', home: 'https://www.zhihu.com/', searchPrefix: 'https://www.zhihu.com/search?type=content&q=' },
  { id: 'xiaohongshu', name: 'Xiaohongshu', home: 'https://www.xiaohongshu.com/explore', searchPrefix: 'https://www.xiaohongshu.com/search_result?keyword=' },
];

for (const { id, name, home, searchPrefix } of SITES) {
  test(`${id}：输入关键词回车跳到搜索页，后退回到进闸门之前的页面`, async ({ context, page }) => {
    const searchUrl = searchPrefix + encodeURIComponent(QUERY);
    await serveStub(context, searchUrl);
    await serveStub(context, 'https://example.com/');
    // 先去别处，再进首页：后退必须落在这个页面上，而不只是「不在闸门」
    await page.goto('https://example.com/');
    await page.goto(home);
    await expect(page).toHaveURL(gateUrl(id));
    await expect(page.locator('h1')).toHaveText(`What did you come to ${name} for?`);
    await expect(page.locator('#q')).toBeFocused();
    await page.locator('#q').fill(QUERY);
    await page.locator('#q').press('Enter');
    await expect(page).toHaveURL(searchUrl);
    await page.goBack();
    await expect(page).toHaveURL('https://example.com/');
  });
}

test('空输入回车不跳转', async ({ page }) => {
  await page.goto('https://www.zhihu.com/');
  await page.locator('#q').fill('   ');
  await page.locator('#q').press('Enter');
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(gateUrl('zhihu'));
});

test('计数：同站累加，各站合计', async ({ page }) => {
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 1 time today · 1 across all sites');
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 2 times today · 2 across all sites');
  await page.goto('https://www.xiaohongshu.com/');
  await expect(page.locator('#stats')).toHaveText('Opened the Xiaohongshu homepage 1 time today · 3 across all sites');
});

test('计数：刷新闸门不计数', async ({ page }) => {
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 1 time today · 1 across all sites');
  await page.reload();
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 1 time today · 1 across all sites');
});

test('计数：点快捷入口后后退回到闸门不计数', async ({ context, page }) => {
  // B站第一个快捷入口：消息
  await serveStub(context, 'https://message.bilibili.com/');
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 1 time today · 1 across all sites');
  await page.locator('#links a').first().click();
  await expect(page).toHaveURL('https://message.bilibili.com/');
  // 只等 commit：万一闸门从 bfcache 恢复，不会触发 load
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL(gateUrl('bilibili'));
  await expect(page.locator('#stats')).toHaveText('Opened the Bilibili homepage 1 time today · 1 across all sites');
});

test('快捷入口按配置渲染', async ({ page }) => {
  await page.goto('https://x.com/home');
  const links = page.locator('#links a');
  await expect(links).toHaveText(['Notifications', 'Chat', 'Bookmarks']);
  await expect(links.first()).toHaveAttribute('href', 'https://x.com/notifications');
});

// constructor、__proto__ 是原型链上的名字，不能被当成站点 id
for (const siteParam of ['nope', 'constructor', '__proto__']) {
  test(`未知 site 参数 ${siteParam}：通用标题，不显示搜索和计数`, async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/gate.html?site=${siteParam}`);
    await expect(page.locator('h1')).toHaveText('What did you come here for?');
    await expect(page.locator('#search')).toBeHidden();
    await expect(page.locator('#links a')).toHaveCount(0);
    await expect(page.locator('#stats')).toBeEmpty();
  });
}
