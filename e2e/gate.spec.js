import { test, expect, gateUrl, serveStub } from './fixtures.js';

const QUERY = '测试 a&b';

const SITES = [
  { id: 'x', name: '推特', home: 'https://x.com/home', searchPrefix: 'https://x.com/search?q=' },
  { id: 'bilibili', name: 'B站', home: 'https://www.bilibili.com/', searchPrefix: 'https://search.bilibili.com/all?keyword=' },
  { id: 'zhihu', name: '知乎', home: 'https://www.zhihu.com/', searchPrefix: 'https://www.zhihu.com/search?type=content&q=' },
  { id: 'xiaohongshu', name: '小红书', home: 'https://www.xiaohongshu.com/explore', searchPrefix: 'https://www.xiaohongshu.com/search_result?keyword=' },
];

for (const { id, name, home, searchPrefix } of SITES) {
  test(`${id}：输入关键词回车跳到搜索页，后退不回闸门`, async ({ context, page }) => {
    const searchUrl = searchPrefix + encodeURIComponent(QUERY);
    await serveStub(context, searchUrl);
    await page.goto(home);
    await expect(page).toHaveURL(gateUrl(id));
    await expect(page.locator('h1')).toHaveText(`你来${name}干什么？`);
    await expect(page.locator('#q')).toBeFocused();
    await page.locator('#q').fill(QUERY);
    await page.locator('#q').press('Enter');
    await expect(page).toHaveURL(searchUrl);
    await page.goBack();
    await expect(page).not.toHaveURL(/gate\.html/);
  });
}

test('空输入回车不跳转', async ({ page }) => {
  await page.goto('https://www.zhihu.com/');
  await page.locator('#q').fill('   ');
  await page.locator('#q').press('Enter');
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(gateUrl('zhihu'));
});

test('计数：同站累加，四站合计', async ({ page }) => {
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('今天第 1 次打开B站首页 · 四站合计 1 次');
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#stats')).toHaveText('今天第 2 次打开B站首页 · 四站合计 2 次');
  await page.goto('https://www.xiaohongshu.com/');
  await expect(page.locator('#stats')).toHaveText('今天第 1 次打开小红书首页 · 四站合计 3 次');
});

test('快捷入口按配置渲染', async ({ page }) => {
  await page.goto('https://x.com/home');
  const links = page.locator('#links a');
  await expect(links).toHaveText(['通知', '私信', '书签']);
  await expect(links.first()).toHaveAttribute('href', 'https://x.com/notifications');
});

test('未知 site 参数：通用标题，不显示搜索和计数', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/gate.html?site=nope`);
  await expect(page.locator('h1')).toHaveText('你来这里干什么？');
  await expect(page.locator('#search')).toBeHidden();
  await expect(page.locator('#links a')).toHaveCount(0);
  await expect(page.locator('#stats')).toBeEmpty();
});
