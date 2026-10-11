import { test as base, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const EXTENSION_DIR = fileURLToPath(new URL('../extension', import.meta.url));

export const test = base.extend({
  // Playwright 默认带 --disable-back-forward-cache；test.use({ bfcache: true }) 恢复成
  // 真实 Chrome 的设置。其余用例保持关闭：开着时 goBack 落到缓存页不触发 load，默认会一直等
  bfcache: [false, { option: true }],
  context: async ({ bfcache }, use) => {
    // channel: 'chromium' 用新版 headless，支持加载扩展
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      ignoreDefaultArgs: bfcache ? ['--disable-back-forward-cache'] : [],
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        // 强制离线：任何真实请求都 DNS 失败。否则 DNR 失效时真实首页会加载，
        // 再被 onCommitted 兜底跳到闸门，测试照样通过，DNR 的问题就被掩盖了
        '--host-resolver-rules=MAP * ~NOTFOUND',
      ],
    });
    await use(context);
    await context.close();
  },
  // auto：每个测试开始前等 DNR 规则装好，否则第一次导航可能抢在规则之前
  extensionId: [
    async ({ context }, use) => {
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      await expect
        .poll(() => worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length))
        .toBe(4);
      await use(new URL(worker.url()).host);
    },
    { auto: true },
  ],
});

export { expect };

export const gateUrl = (siteId) => new RegExp(`^chrome-extension://[a-p]{32}/gate\\.html\\?site=${siteId}$`);

// 用本地桩页面响应某个确切 URL，测试不依赖真实网站、网络和登录
export async function serveStub(context, url, body = '') {
  await context.route(
    (u) => u.href === url,
    (route) => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><title>stub</title>${body}`,
    }),
  );
}
