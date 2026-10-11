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

// DNR 看不到的首页导航都靠这两个监听拦：SPA pushState、bfcache 恢复、
// 网站自己的 service worker 应答的导航（如 X 的 PWA）、DNR 规则缺失
function gateIfHomepage({ tabId, frameId, url }) {
  if (frameId !== 0) return;
  const site = matchHomepage(url);
  if (!site) return;
  const gateUrl = chrome.runtime.getURL(gatePath(site.id));
  // 用 location.replace 替换掉首页这条历史记录（和 DNR 重定向一致），
  // tabs.update 会新增一条，后退回到首页又被拦，用户就被困住了
  chrome.scripting
    .executeScript({
      target: { tabId, frameIds: [0] },
      func: (url) => location.replace(url),
      args: [gateUrl],
      injectImmediately: true,
    })
    .catch((error) => {
      console.warn('feed-gate: executeScript failed, falling back to tabs.update', error);
      return chrome.tabs.update(tabId, { url: gateUrl }).catch(() => {});
    });
}

const filter = { url: SITES.flatMap((site) => site.hosts.map((host) => ({ hostEquals: host }))) };
chrome.webNavigation.onHistoryStateUpdated.addListener(gateIfHomepage, filter);
chrome.webNavigation.onCommitted.addListener(gateIfHomepage, filter);
