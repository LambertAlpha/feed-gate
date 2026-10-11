// stats 形如 { date: 'YYYY-MM-DD', counts: { [siteId]: number } }，只保留当天
export function todayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function bumpStats(stats, siteId, today) {
  const counts = stats?.date === today ? { ...stats.counts } : {};
  counts[siteId] = (counts[siteId] ?? 0) + 1;
  return { date: today, counts };
}

export function totalCount(stats) {
  return Object.values(stats.counts).reduce((sum, n) => sum + n, 0);
}
