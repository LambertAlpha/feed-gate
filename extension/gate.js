import { SITES_BY_ID, searchUrlFor } from './sites.js';
import { bumpStats, todayKey, totalCount } from './stats.js';

const titleEl = document.getElementById('title');
const formEl = document.getElementById('search');
const inputEl = document.getElementById('q');
const linksEl = document.getElementById('links');
const statsEl = document.getElementById('stats');

const site = SITES_BY_ID[new URLSearchParams(location.search).get('site')] ?? null;

if (site) {
  showGate(site);
  // 统计失败不影响拦截，只是不显示次数
  recordVisit(site).catch(() => {});
} else {
  titleEl.textContent = '你来这里干什么？';
  formEl.hidden = true;
}

function showGate(site) {
  const question = `你来${site.name}干什么？`;
  document.title = question;
  titleEl.textContent = question;
  inputEl.placeholder = `搜索${site.name}`;
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

async function recordVisit(site) {
  const { stats } = await chrome.storage.local.get('stats');
  const next = bumpStats(stats, site.id, todayKey(new Date()));
  await chrome.storage.local.set({ stats: next });
  statsEl.textContent = `今天第 ${next.counts[site.id]} 次打开${site.name}首页 · 四站合计 ${totalCount(next)} 次`;
}
