const { chromium } = require('@playwright/test');

(async () => {
  if (!process.env.PREVIEW_ADMIN_PASSWORD) throw new Error('Set PREVIEW_ADMIN_PASSWORD before running this preview');
  const br = await chromium.launch({ headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login page
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/mr-login.png' });
  console.log('login done');

  // Dashboard
  await page.fill('input[type="email"]', 'admin@demo-agency.com');
  await page.fill('input[type="password"]', process.env.PREVIEW_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 12000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/mr-dashboard.png' });
  console.log('dashboard done');

  await br.close();
})();
