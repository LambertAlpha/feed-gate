import { SITES, matchHomepage, gatePath } from './sites.js';
import { buildRedirectRules } from './rules.js';

// 动态规则会跨重启保留；每次全量重建，保证和 sites.js 一致
async function installRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: buildRedirectRules(),
  });
}

chrome.runtime.onInstalled.addListener(installRules);
chrome.runtime.onStartup.addListener(installRules);

// DNR 只拦得到真正发出的请求。SPA 站内跳转（pushState）和后退恢复缓存页（bfcache）
// 不发请求，靠这里兜底
function gateIfHomepage({ tabId, frameId, url }) {
  if (frameId !== 0) return;
  const site = matchHomepage(url);
  if (site) chrome.tabs.update(tabId, { url: chrome.runtime.getURL(gatePath(site.id)) });
}

const filter = { url: SITES.flatMap((site) => site.hosts.map((host) => ({ hostEquals: host }))) };
chrome.webNavigation.onHistoryStateUpdated.addListener(gateIfHomepage, filter);
chrome.webNavigation.onCommitted.addListener(gateIfHomepage, filter);
