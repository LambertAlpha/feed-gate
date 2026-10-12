import { SITES_BY_ID, searchUrlFor } from './sites.js';
import { bumpStats, todayKey, totalCount } from './stats.js';

const titleEl = document.getElementById('title');
const formEl = document.getElementById('search');
const inputEl = document.getElementById('q');
const linksEl = document.getElementById('links');
const statsEl = document.getElementById('stats');

// hasOwn：constructor、__proto__ 这类原型链上的名字不能当成站点
const siteId = new URLSearchParams(location.search).get('site');
const site = Object.hasOwn(SITES_BY_ID, siteId) ? SITES_BY_ID[siteId] : null;

if (site) {
  showGate(site);
  // 统计失败不影响拦截，只是不显示次数
  showStats(site).catch(() => {});
} else {
  titleEl.textContent = 'What did you come here for?';
  formEl.hidden = true;
}

function showGate(site) {
  const question = `What did you come to ${site.name} for?`;
  document.title = question;
  titleEl.textContent = question;
  inputEl.placeholder = `Search ${site.name}`;
  for (const { label, url } of site.links) {
    const a = document.createElement('a');
    a.href = url;
    a.textContent = label;
    linksEl.append(a);
  }
  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = searchUrlFor(site, inputEl.value);
    // replace：按后退不会回到闸门
    if (url) location.replace(url);
  });
  inputEl.focus();
}

// 刷新、前进后退回到闸门不是新的一次「打开首页」，只显示当前计数，不写入
function isRevisit() {
  const type = performance.getEntriesByType('navigation')[0]?.type;
  return type === 'reload' || type === 'back_forward';
}

async function showStats(site) {
  const { stats } = await chrome.storage.local.get('stats');
  const today = todayKey(new Date());
  let current = stats;
  if (!isRevisit()) {
    current = bumpStats(stats, site.id, today);
    await chrome.storage.local.set({ stats: current });
  }
  // 只显示今天确有记录的次数；没有（如隔天刷新昨天的闸门）就留空，不编造
  const count = current?.date === today ? current.counts[site.id] : undefined;
  if (!count) return;
  const times = count === 1 ? '1 time' : `${count} times`;
  statsEl.textContent = `Opened the ${site.name} homepage ${times} today · ${totalCount(current)} across all sites`;
}
