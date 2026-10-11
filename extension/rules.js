import { SITES, gatePath } from './sites.js';

export function buildRedirectRules() {
  return SITES.map((site, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: gatePath(site.id) } },
    condition: {
      regexFilter: site.homepage,
      // DNR 默认不区分大小写，JS RegExp 区分；统一成区分，两边判断才一致
      isUrlFilterCaseSensitive: true,
      resourceTypes: ['main_frame'],
    },
  }));
}
