import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITES } from '../extension/sites.js';

const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

// Chrome 匹配模式 https://*.example.com/* 同时覆盖 example.com 本身和它的子域名
function covers(pattern, host) {
  const m = /^https:\/\/\*\.([^/]+)\/\*$/.exec(pattern);
  return m !== null && (host === m[1] || host.endsWith(`.${m[1]}`));
}

test('MV3，background 是 module service worker', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' });
});

test('只申请需要的权限', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['declarativeNetRequest', 'storage', 'webNavigation']);
});

test('host_permissions 覆盖所有站点域名（DNR 重定向需要）', () => {
  for (const site of SITES) {
    for (const host of site.hosts) {
      assert.ok(manifest.host_permissions.some((p) => covers(p, host)), host);
    }
  }
});

test('闸门页对所有来源可访问（从其他网站点链接进首页也要能重定向）', () => {
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ['gate.html'], matches: ['<all_urls>'] }]);
});
