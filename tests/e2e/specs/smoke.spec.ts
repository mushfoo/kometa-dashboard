import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');

    // Verify page loaded
    await expect(page).toHaveTitle(/Kometa Dashboard/);

    // Verify main content area with welcome heading
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toContainText(
      'Welcome to Kometa Dashboard'
    );

    // Verify navigation cards are visible
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/config"]')).toBeVisible();
    await expect(page.locator('a[href="/collections"]')).toBeVisible();
    await expect(page.locator('a[href="/logs"]')).toBeVisible();
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('/');

    // Click dashboard link
    await page.click('a[href="/dashboard"]');

    // Verify navigation
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should navigate to configuration', async ({ page }) => {
    await page.goto('/');

    // Click configuration link
    await page.click('a[href="/config"]');

    // Verify navigation
    await expect(page).toHaveURL(/\/config/);
    await expect(page.locator('h1')).toContainText('Configuration');
  });

  test('should have responsive design', async ({ page }) => {
    // Go to dashboard to see the layout
    await page.goto('/dashboard');

    // Test desktop - mobile menu button should be hidden on large screens
    await page.setViewportSize({ width: 1920, height: 1080 });
    const mobileMenuButton = page
      .locator('button')
      .filter({ hasText: 'Menu' })
      .first();
    await expect(mobileMenuButton).toHaveClass(/lg:hidden/);

    // Test mobile - mobile menu button should be visible
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(mobileMenuButton).toBeVisible();
  });

  test('should handle 404 pages', async ({ page }) => {
    const response = await page.goto('/non-existent-page');

    // Should return 404 status
    expect(response?.status()).toBe(404);

    // Should show Not Found page
    await expect(page.locator('h1, h2')).toContainText(/Not Found|404/);
  });
});
