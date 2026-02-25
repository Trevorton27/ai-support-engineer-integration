import { test, expect } from '@playwright/test';

test.describe('Copilot Panel', () => {
  test('should show async status transitions for analyze', async ({ page }) => {
    // Mock the API responses
    let suggestionId = 'test-suggestion-123';

    // Mock analyze endpoint to return queued state
    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            suggestionId: suggestionId,
            state: 'queued',
          },
        }),
      });
    });

    // Mock status endpoint to simulate state transitions
    let callCount = 0;
    await page.route(`**/api/copilot/v1/status/${suggestionId}`, async (route) => {
      callCount++;

      // First call: queued
      if (callCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'queued',
              content: {},
              error: null,
              kind: 'analysis',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
      // Second call: running
      else if (callCount === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'running',
              content: {},
              error: null,
              kind: 'analysis',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
      // Third call onwards: success
      else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'success',
              content: {
                summary: 'Test ticket analysis summary',
                sentiment: 'neutral',
                category: 'technical',
                urgency: 'medium',
                suggestedActions: ['Review logs', 'Contact customer'],
              },
              error: null,
              kind: 'analysis',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Navigate to a page with CopilotPanel (adjust URL as needed)
    await page.goto('/tickets/test-ticket-id');

    // Click analyze button
    await page.click('[data-testid="analyze-button"]');

    // Should show queued state
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Queued',
      { timeout: 2000 },
    );

    // Should transition to running
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Processing',
      { timeout: 5000 },
    );

    // Should eventually show success
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );

    // Should display structured results
    await expect(
      page.locator('[data-testid="analysis-summary"]'),
    ).toBeVisible();
    await expect(page.locator('text=Test ticket analysis summary')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'AI service unavailable',
        }),
      });
    });

    await page.goto('/tickets/test-ticket-id');
    await page.click('[data-testid="analyze-button"]');

    // Should not show any state indicator since request failed before creating suggestion
    await expect(page.locator('[data-testid="copilot-state"]')).not.toBeVisible();
  });

  test('should handle error state from async job', async ({ page }) => {
    let suggestionId = 'test-suggestion-error';

    // Mock analyze endpoint
    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            suggestionId: suggestionId,
            state: 'queued',
          },
        }),
      });
    });

    // Mock status endpoint to return error state
    await page.route(`**/api/copilot/v1/status/${suggestionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: suggestionId,
            state: 'error',
            content: {},
            error: 'Failed to analyze ticket: API timeout',
            kind: 'analysis',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/tickets/test-ticket-id');
    await page.click('[data-testid="analyze-button"]');

    // Should show error state
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Error',
      { timeout: 5000 },
    );

    // Should display error message
    await expect(page.locator('[data-testid="copilot-error"]')).toContainText(
      'Failed to analyze ticket: API timeout',
    );
  });
});
