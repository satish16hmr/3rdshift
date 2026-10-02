/**
 * Smoke tests — critical UI paths
 * Brief: homepage, login page, login flow, dashboard (post-login)
 *
 * Run: BASE_URL=https://3rdshift.ai SMOKE_USER_EMAIL=... SMOKE_USER_PASSWORD=... npx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

const EMAIL    = process.env.SMOKE_USER_EMAIL    ?? 'test-roger@3rdshift.ai';
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log in")');
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

// 1. Homepage loads
test('homepage loads', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('body')).toContainText('3rdShift');
});

// 2. Login page loads and shows form
test('login page loads', async ({ page }) => {
  const res = await page.goto('/login');
  expect(res?.status()).toBe(200);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

// 3. Login actually works + 4. Dashboard loads after login
test('login works and dashboard loads', async ({ page }) => {
  if (!PASSWORD) test.skip();
  await login(page);
  expect(page.url()).toMatch(/\/dashboard/);
  const res = await page.goto('/dashboard');
  expect(res?.status()).toBe(200);
});
