import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES } from '../extension/sites.js';
import { buildRedirectRules } from '../extension/rules.js';

test('每站一条规则，id 从 1 连续递增', () => {
  const rules = buildRedirectRules();
  assert.deepEqual(rules.map((r) => r.id), SITES.map((_, i) => i + 1));
});

test('规则把首页的主框架请求重定向到对应闸门页，大小写敏感与 JS 一致', () => {
  const rules = buildRedirectRules();
  SITES.forEach((site, i) => {
    assert.deepEqual(rules[i], {
      id: i + 1,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: `/gate.html?site=${site.id}` } },
      condition: {
        regexFilter: site.homepage,
        isUrlFilterCaseSensitive: true,
        resourceTypes: ['main_frame'],
      },
    });
  });
});
