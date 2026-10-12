// 唯一配置源。homepage 正则同时用作 DNR 的 regexFilter（RE2）和 JS 的 RegExp，
// 只能用两者共同支持的语法：不用前瞻/后顾、不用反向引用、仅 ASCII。
// 结尾的 ([?#].*)? 允许查询参数和锚点，但不允许更深的路径。
export const SITES = [
  {
    id: 'x',
    name: 'X',
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    homepage: String.raw`^https://(www\.)?(x|twitter)\.com/(home/?)?([?#].*)?$`,
    searchPrefix: 'https://x.com/search?q=',
    links: [
      { label: 'Notifications', url: 'https://x.com/notifications' },
      { label: 'Chat', url: 'https://x.com/i/chat' },
      { label: 'Bookmarks', url: 'https://x.com/i/bookmarks' },
    ],
  },
  {
    id: 'bilibili',
    name: 'Bilibili',
    hosts: ['www.bilibili.com', 'bilibili.com'],
    homepage: String.raw`^https://(www\.)?bilibili\.com/([?#].*)?$`,
    searchPrefix: 'https://search.bilibili.com/all?keyword=',
    links: [
      { label: 'Messages', url: 'https://message.bilibili.com/' },
      { label: 'Watch Later', url: 'https://www.bilibili.com/watchlater/list' },
      { label: 'History', url: 'https://www.bilibili.com/history' },
    ],
  },
  {
    id: 'zhihu',
    name: 'Zhihu',
    hosts: ['www.zhihu.com', 'zhihu.com'],
    homepage: String.raw`^https://(www\.)?zhihu\.com/([?#].*)?$`,
    searchPrefix: 'https://www.zhihu.com/search?type=content&q=',
    links: [
      { label: 'Notifications', url: 'https://www.zhihu.com/notifications' },
      { label: 'Messages', url: 'https://www.zhihu.com/messages' },
    ],
  },
  {
    id: 'xiaohongshu',
    name: 'Xiaohongshu',
    hosts: ['www.xiaohongshu.com', 'xiaohongshu.com'],
    // /explore 是发现页（推荐流），/explore/<笔记ID> 是笔记详情，后者不能拦
    homepage: String.raw`^https://(www\.)?xiaohongshu\.com/(explore/?)?([?#].*)?$`,
    searchPrefix: 'https://www.xiaohongshu.com/search_result?keyword=',
    links: [
      { label: 'Notifications', url: 'https://www.xiaohongshu.com/notification' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    hosts: ['www.instagram.com', 'instagram.com'],
    // 只拦根路径（含 ?variant=following）；/explore/、/reels/ 与其他站的热门页一样不在范围内
    homepage: String.raw`^https://(www\.)?instagram\.com/([?#].*)?$`,
    searchPrefix: 'https://www.instagram.com/explore/search/keyword/?q=',
    links: [
      { label: 'Messages', url: 'https://www.instagram.com/direct/inbox/' },
      { label: 'Notifications', url: 'https://www.instagram.com/notifications/' },
    ],
  },
];

export const SITES_BY_ID = Object.fromEntries(SITES.map((site) => [site.id, site]));

const HOMEPAGE_MATCHERS = SITES.map((site) => [site, new RegExp(site.homepage)]);

export function matchHomepage(url) {
  for (const [site, re] of HOMEPAGE_MATCHERS) {
    if (re.test(url)) return site;
  }
  return null;
}

export function gatePath(siteId) {
  return `/gate.html?site=${siteId}`;
}

export function searchUrlFor(site, query) {
  const trimmed = query.trim();
  return trimmed ? site.searchPrefix + encodeURIComponent(trimmed) : null;
}
