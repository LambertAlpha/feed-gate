import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES, SITES_BY_ID, matchHomepage, searchUrlFor, gatePath } from '../extension/sites.js';

// 必须被拦的首页，按站点分组
const HOMEPAGES = {
  x: [
    'https://x.com/',
    'https://x.com/home',
    'https://x.com/home/',
    'https://x.com/home?lang=zh',
    'https://www.x.com/',
    'https://twitter.com/home',
  ],
  bilibili: [
    'https://www.bilibili.com/',
    'https://bilibili.com/',
    'https://www.bilibili.com/?spm_id_from=333.1007.0.0',
  ],
  zhihu: [
    'https://www.zhihu.com/',
    'https://zhihu.com/',
    'https://www.zhihu.com/?utm_source=bookmark',
  ],
  xiaohongshu: [
    'https://www.xiaohongshu.com/',
    'https://www.xiaohongshu.com/explore',
    'https://www.xiaohongshu.com/explore/',
    'https://www.xiaohongshu.com/explore?channel_id=homefeed.fashion_v3',
  ],
};

// 绝不能拦的页面：拦了会让插件没法用
const NOT_HOMEPAGES = [
  'https://x.com/search?q=a',
  'https://x.com/elonmusk',
  'https://x.com/homer',
  'https://x.com/notifications',
  'https://x.com/explore',
  'https://www.bilibili.com/video/BV1GJ411x7h7',
  'https://www.bilibili.com/v/popular/all',
  'https://search.bilibili.com/all?keyword=a',
  'https://t.bilibili.com/',
  'https://www.zhihu.com/question/19550225',
  'https://www.zhihu.com/hot',
  'https://www.zhihu.com/follow',
  'https://zhuanlan.zhihu.com/',
  'https://www.xiaohongshu.com/explore/64f1a2b3c4d5e6f7a8b9c0d1',
  'https://www.xiaohongshu.com/explore/64f1a2b3c4d5e6f7a8b9c0d1?xsec_token=abc',
  'https://www.xiaohongshu.com/search_result?keyword=a',
  'https://example.com/',
  'https://notx.com/',
  'https://x.com.evil.com/',
];

test('四个站点 id 唯一，SITES_BY_ID 一一对应', () => {
  assert.deepEqual(SITES.map((s) => s.id), ['x', 'bilibili', 'zhihu', 'xiaohongshu']);
  for (const site of SITES) assert.equal(SITES_BY_ID[site.id], site);
});

test('首页 URL 匹配到对应站点', () => {
  for (const [id, urls] of Object.entries(HOMEPAGES)) {
    for (const url of urls) assert.equal(matchHomepage(url)?.id, id, url);
  }
});

test('非首页 URL 不匹配任何站点', () => {
  for (const url of NOT_HOMEPAGES) assert.equal(matchHomepage(url), null, url);
});

test('首页样例的域名都列在该站 hosts 里（webNavigation 过滤器依赖它）', () => {
  for (const [id, urls] of Object.entries(HOMEPAGES)) {
    for (const url of urls) assert.ok(SITES_BY_ID[id].hosts.includes(new URL(url).hostname), url);
  }
});

test('首页正则只用 RE2 与 JS 共同支持的语法', () => {
  for (const site of SITES) {
    assert.doesNotMatch(site.homepage, /\(\?[=!<]/, `${site.id}：不能用前瞻/后顾`);
    assert.doesNotMatch(site.homepage, /\\[1-9]/, `${site.id}：不能用反向引用`);
    assert.match(site.homepage, /^[\x20-\x7e]+$/, `${site.id}：只能是 ASCII`);
  }
});

test('快捷入口都是 https，且不是首页（否则闸门会拦掉自己的入口）', () => {
  for (const site of SITES) {
    assert.ok(site.links.length > 0, site.id);
    for (const link of site.links) {
      assert.ok(link.url.startsWith('https://'), link.url);
      assert.equal(matchHomepage(link.url), null, link.url);
    }
  }
});

test('searchUrlFor 去掉首尾空白并编码', () => {
  assert.equal(
    searchUrlFor(SITES_BY_ID.bilibili, '  测试 a&b  '),
    'https://search.bilibili.com/all?keyword=%E6%B5%8B%E8%AF%95%20a%26b',
  );
  assert.equal(searchUrlFor(SITES_BY_ID.x, 'claude'), 'https://x.com/search?q=claude');
  assert.equal(searchUrlFor(SITES_BY_ID.zhihu, 'claude'), 'https://www.zhihu.com/search?type=content&q=claude');
  assert.equal(searchUrlFor(SITES_BY_ID.xiaohongshu, 'claude'), 'https://www.xiaohongshu.com/search_result?keyword=claude');
});

test('searchUrlFor 对空输入返回 null', () => {
  assert.equal(searchUrlFor(SITES_BY_ID.x, ''), null);
  assert.equal(searchUrlFor(SITES_BY_ID.x, '   '), null);
});

test('gatePath 指向扩展根目录的闸门页', () => {
  assert.equal(gatePath('x'), '/gate.html?site=x');
});
