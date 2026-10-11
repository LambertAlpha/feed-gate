import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, bumpStats, totalCount } from '../extension/stats.js';

test('todayKey 用本地日期，补零', () => {
  assert.equal(todayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(todayKey(new Date(2026, 9, 11, 0, 0)), '2026-10-11');
});

test('bumpStats 从空开始计数', () => {
  assert.deepEqual(bumpStats(undefined, 'x', '2026-10-11'), { date: '2026-10-11', counts: { x: 1 } });
});

test('bumpStats 同一天累加，且不修改传入对象', () => {
  const before = { date: '2026-10-11', counts: { x: 1, zhihu: 2 } };
  const after = bumpStats(before, 'x', '2026-10-11');
  assert.deepEqual(after, { date: '2026-10-11', counts: { x: 2, zhihu: 2 } });
  assert.deepEqual(before, { date: '2026-10-11', counts: { x: 1, zhihu: 2 } });
});

test('bumpStats 跨天清零', () => {
  const yesterday = { date: '2026-10-10', counts: { x: 9, zhihu: 3 } };
  assert.deepEqual(bumpStats(yesterday, 'zhihu', '2026-10-11'), { date: '2026-10-11', counts: { zhihu: 1 } });
});

test('totalCount 合计所有站点', () => {
  assert.equal(totalCount({ date: '2026-10-11', counts: { x: 2, bilibili: 1, zhihu: 4 } }), 7);
});
