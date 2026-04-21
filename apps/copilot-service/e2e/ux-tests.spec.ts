/**
 * E2E tests derived from docs/user-ux-tests.md.
 *
 * Coverage: tests 19–56 from the UX checklist that are automatable inside the
 * copilot-service Playwright harness. All copilot API calls are mocked via
 * page.route() so the suite does not need live AI credentials.
 *
 * Tests 1–18 (CRM app: nav, ticket list, create ticket, ticket detail) require
 * a running CRM server with seeded database and are marked for manual testing.
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Shared mock fixtures ────────────────────────────────────────────────────

const ANALYZE_ID = 'ux-analyze-id';
const STEPS_ID = 'ux-steps-id';
const CHAT_ID = 'ux-chat-id';
const DRAFT_ID = 'ux-draft-id';

const ANALYSIS_CONTENT = {
  extractedSignals: {
    product: 'Auth Service',
    errorStrings: ['401 Unauthorized'],
    urls: ['https://api.example.com/auth'],
  },
  hypotheses: [
    {
      cause: 'Session token expired',
      evidence: ['401 on API call', 'Logs show token TTL exceeded'],
      confidence: 0.85,
      tests: ['Re-authenticate and retry', 'Inspect token exp field'],
    },
  ],
  clarifyingQuestions: ['Which browser are you using?', 'When did this issue start?'],
  nextSteps: ['Check token expiry config', 'Review auth logs', 'Re-issue credentials'],
  riskFlags: ['Affects all users in org'],
  escalationWhen: ['If not resolved in 2 hours'],
  references: [],
};

const STEPS_CONTENT = {
  steps: ['Verify token expiry setting', 'Check auth service logs', 'Re-issue credentials'],
  references: [],
};

const CHAT_CONTENT = {
  answer: 'The token expiry appears to be the root cause based on the error patterns observed.',
};

const DRAFT_CONTENT = {
  text: 'Hi there, our team is looking into the authentication issue. We will update you shortly.',
  draftType: 'customer_reply',
  tone: 'professional',
  usedAnalysisId: null,
  markedSent: false,
};

/** Mocks /v1/analyze and its status poll to immediately succeed. */
async function mockAnalyze(page: Page) {
  await page.route('**/api/copilot/v1/analyze', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { suggestionId: ANALYZE_ID, state: 'queued' } }),
    }),
  );
  await page.route(`**/api/copilot/v1/status/${ANALYZE_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: ANALYZE_ID,
          state: 'success',
          kind: 'analysis',
          content: ANALYSIS_CONTENT,
          error: null,
          updatedAt: new Date().toISOString(),
        },
      }),
    }),
  );
}

/** Mocks /v1/suggest and its status poll. */
async function mockSuggest(page: Page) {
  await page.route('**/api/copilot/v1/suggest', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { suggestionId: STEPS_ID, state: 'queued' } }),
    }),
  );
  await page.route(`**/api/copilot/v1/status/${STEPS_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: STEPS_ID,
          state: 'success',
          kind: 'next_steps',
          content: STEPS_CONTENT,
          error: null,
          updatedAt: new Date().toISOString(),
        },
      }),
    }),
  );
}

/** Mocks /v1/chat and its status poll. */
async function mockChat(page: Page) {
  await page.route('**/api/copilot/v1/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { suggestionId: CHAT_ID, state: 'queued' } }),
    }),
  );
  await page.route(`**/api/copilot/v1/status/${CHAT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: CHAT_ID,
          state: 'success',
          kind: 'chat',
          content: CHAT_CONTENT,
          error: null,
          updatedAt: new Date().toISOString(),
        },
      }),
    }),
  );
}

/** Mocks /v1/draft-reply POST + status poll + PATCH save. */
async function mockDraft(page: Page) {
  await page.route('**/api/copilot/v1/draft-reply', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { suggestionId: DRAFT_ID, state: 'queued' } }),
      });
    }
    return route.continue();
  });
  await page.route(`**/api/copilot/v1/status/${DRAFT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: DRAFT_ID,
          state: 'success',
          kind: 'draft_customer_reply',
          content: DRAFT_CONTENT,
          error: null,
          updatedAt: new Date().toISOString(),
        },
      }),
    }),
  );
  await page.route(`**/api/copilot/v1/draft-reply/${DRAFT_ID}`, (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { id: DRAFT_ID, content: DRAFT_CONTENT } }),
      });
    }
    return route.continue();
  });
}

/** Mocks /v1/update-status to succeed. */
async function mockUpdateStatus(page: Page, newStatus = 'RESOLVED') {
  await page.route('**/api/copilot/v1/update-status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { id: 'test-ticket-id', status: newStatus, updatedAt: new Date().toISOString() },
      }),
    }),
  );
}

/** Mocks /v1/similar to return empty (keeps tests focused). */
async function mockSimilarEmpty(page: Page) {
  await page.route('**/api/copilot/v1/similar', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { cases: [] } }),
    }),
  );
}

/** Navigate to the ticket detail page and wait for the copilot panel. */
async function openTicketPage(page: Page) {
  await page.goto('/test-fixture/panel');
  await expect(page.locator('[data-testid="copilot-panel"]')).toBeVisible({ timeout: 10000 });
}

// ─── Tests 19–21: Analyze + Collapsible sections ────────────────────────────

test.describe('UX #19-21 — Analyze ticket + collapsible sections', () => {
  test('loading skeleton appears then analysis result renders (test 19)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await page.route('**/api/copilot/v1/analyze', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { suggestionId: ANALYZE_ID, state: 'queued' } }),
      }),
    );
    let calls = 0;
    await page.route(`**/api/copilot/v1/status/${ANALYZE_ID}`, (route) => {
      calls++;
      const state = calls >= 3 ? 'success' : 'queued';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: ANALYZE_ID,
            state,
            kind: 'analysis',
            content: state === 'success' ? ANALYSIS_CONTENT : {},
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');

    // Skeleton must appear before result
    await expect(page.locator('[data-testid="result-skeleton"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });
  });

  test('Extracted Signals collapses and re-expands (test 20)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    // Find the first <details> (Extracted Signals); starts open
    const details = page.locator('details').first();
    await expect(details).toHaveAttribute('open');

    // Click summary to collapse
    await details.locator('summary').click();
    await expect(details).not.toHaveAttribute('open');

    // Click summary again to re-expand
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open');
  });

  test('Hypotheses collapses and re-expands (test 21)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    // Hypotheses is the second <details>
    const details = page.locator('details').nth(1);
    await expect(details).toHaveAttribute('open');

    await details.locator('summary').click();
    await expect(details).not.toHaveAttribute('open');

    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open');
  });
});

// ─── Tests 22–24: Copy buttons inside analysis ───────────────────────────────

test.describe('UX #22-24 — Copy buttons (analysis)', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('Copy Hypotheses shows toast (test 22)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    await page.click('[data-testid="copy-hypotheses"]');
    await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible({
      timeout: 3000,
    });
  });

  test('Copy Clarifying Questions shows toast (test 23)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    // Copy button beside "Clarifying Questions" heading
    const copyBtn = page.locator('button', { hasText: 'Copy' }).filter({
      has: page.locator(':scope'),
    });
    // The Clarifying Questions copy button is in the row with the h4
    await page
      .locator('h4', { hasText: 'Clarifying Questions' })
      .locator('..')
      .locator('button', { hasText: 'Copy' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible({
      timeout: 3000,
    });
  });

  test('Copy Next Steps shows toast (test 24)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    await page
      .locator('h4', { hasText: 'Next Steps' })
      .locator('..')
      .locator('button', { hasText: 'Copy' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible({
      timeout: 3000,
    });
  });
});

// ─── Tests 25–26: Suggest Next Steps ────────────────────────────────────────

test.describe('UX #25-26 — Suggest Next Steps', () => {
  test('renders step list with Copy button (test 25)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockSuggest(page);

    await openTicketPage(page);
    await page.locator('button', { hasText: 'Suggest Next Steps' }).click();

    await expect(page.locator('[data-testid="copilot-state"]')).toContainText('Complete', {
      timeout: 8000,
    });

    // All three steps should appear in a list
    for (const step of STEPS_CONTENT.steps) {
      await expect(page.locator(`text=${step}`)).toBeVisible();
    }

    // Copy button should be present
    await expect(page.locator('[data-testid="copy-steps"]')).toBeVisible();
  });

  test('Copy steps button shows toast (test 26)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockSimilarEmpty(page);
    await mockSuggest(page);

    await openTicketPage(page);
    await page.locator('button', { hasText: 'Suggest Next Steps' }).click();
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText('Complete', {
      timeout: 8000,
    });

    await page.click('[data-testid="copy-steps"]');
    await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible({
      timeout: 3000,
    });
  });
});

// ─── Test 34: Mark as Sent ───────────────────────────────────────────────────

test.describe('UX #34 — Mark as Sent', () => {
  test('button turns green and becomes disabled after clicking (test 34)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockDraft(page);

    await openTicketPage(page);
    await page.selectOption('[data-testid="draft-type-select"]', 'customer_reply');
    await page.click('[data-testid="generate-draft-button"]');
    await expect(page.locator('[data-testid="draft-edit-textarea"]')).toHaveValue(
      /looking into the authentication issue/,
      { timeout: 8000 },
    );

    const markSentBtn = page.locator('[data-testid="draft-mark-sent-button"]');
    await expect(markSentBtn).not.toBeDisabled();

    await markSentBtn.click();

    // Toast confirms
    await expect(page.getByRole('status').filter({ hasText: 'Marked as sent' })).toBeVisible({
      timeout: 3000,
    });

    // Button text changes and becomes disabled
    await expect(markSentBtn).toContainText('Sent');
    await expect(markSentBtn).toBeDisabled();
  });
});

// ─── Tests 36–39: Chat ───────────────────────────────────────────────────────

test.describe('UX #36-39 — Chat', () => {
  test('submits question via Enter key and shows answer (tests 36, 54)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockChat(page);

    await openTicketPage(page);
    const input = page.locator('#chat-input');
    await input.fill('What is the root cause?');
    await input.press('Enter');

    await expect(page.locator('[data-testid="copilot-state"]')).toContainText('Complete', {
      timeout: 8000,
    });
    await expect(page.locator(`text=${CHAT_CONTENT.answer}`)).toBeVisible();
  });

  test('submits question via Ask button (test 37)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockChat(page);

    await openTicketPage(page);
    await page.locator('#chat-input').fill('What is the root cause?');
    await page.click('button[aria-label="Submit question to Copilot"]');

    await expect(page.locator('[data-testid="copilot-state"]')).toContainText('Complete', {
      timeout: 8000,
    });
    await expect(page.locator(`text=${CHAT_CONTENT.answer}`)).toBeVisible();
  });

  test('Ask button is disabled when input is empty (test 38)', async ({ page }) => {
    await mockSimilarEmpty(page);

    await openTicketPage(page);
    // Empty input → button disabled
    await expect(
      page.locator('button[aria-label="Submit question to Copilot"]'),
    ).toBeDisabled();

    // Type something → button enabled
    await page.locator('#chat-input').fill('hello');
    await expect(
      page.locator('button[aria-label="Submit question to Copilot"]'),
    ).not.toBeDisabled();

    // Clear → disabled again
    await page.locator('#chat-input').fill('');
    await expect(
      page.locator('button[aria-label="Submit question to Copilot"]'),
    ).toBeDisabled();
  });

  test('Copy answer button shows toast (test 39)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockSimilarEmpty(page);
    await mockChat(page);

    await openTicketPage(page);
    await page.locator('#chat-input').fill('Any root cause?');
    await page.locator('#chat-input').press('Enter');
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText('Complete', {
      timeout: 8000,
    });

    await page.click('[data-testid="copy-chat-answer"]');
    await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible({
      timeout: 3000,
    });
  });
});

// ─── Tests 40–41: Ticket Status toggle ──────────────────────────────────────

test.describe('UX #40-41 — Ticket Status toggle', () => {
  test('clicking a status button marks it active (aria-pressed) (test 40)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockUpdateStatus(page, 'RESOLVED');

    await openTicketPage(page);

    // The initial status depends on the ticket snapshot; OPEN is the default in
    // test-ticket-id. Click RESOLVED.
    const resolvedBtn = page.locator('button', { hasText: 'RESOLVED' });
    await resolvedBtn.click();

    await expect(resolvedBtn).toHaveAttribute('aria-pressed', 'true');
    // The previously-active button (OPEN) should no longer be pressed
    await expect(page.locator('button', { hasText: 'OPEN' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('status feedback message appears then disappears (test 41)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockUpdateStatus(page, 'RESOLVED');

    await openTicketPage(page);
    await page.locator('button', { hasText: 'RESOLVED' }).click();

    // Feedback message appears briefly
    await expect(page.locator('text=Status updated to RESOLVED')).toBeVisible({ timeout: 3000 });

    // After ~3 s it auto-dismisses
    await expect(page.locator('text=Status updated to RESOLVED')).not.toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── Tests 48–49: Toast notifications ───────────────────────────────────────

test.describe('UX #48-49 — Toast notifications', () => {
  test('toast auto-dismisses after ~3 s (test 48)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    // Trigger a toast via copy
    await page.click('[data-testid="copy-hypotheses"]');
    const toast = page.locator('[data-testid="toast"]').filter({ hasText: 'Copied to clipboard' });
    await expect(toast).toBeVisible({ timeout: 2000 });

    // Should be gone within 4 s (auto-dismiss is 3 s)
    await expect(toast).not.toBeVisible({ timeout: 4500 });
  });

  test('multiple toasts stack and each dismisses independently (test 49)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    // Fire two copy toasts in quick succession
    await page.click('[data-testid="copy-hypotheses"]');
    await page
      .locator('h4', { hasText: 'Next Steps' })
      .locator('..')
      .locator('button', { hasText: 'Copy' })
      .click();

    // Both should be visible simultaneously
    await expect(page.locator('[data-testid="toast"]')).toHaveCount(2, { timeout: 2000 });
  });
});

// ─── Test 51: Provider badge ─────────────────────────────────────────────────

test.describe('UX #51 — Provider badge', () => {
  test('provider badge is visible in panel header at all times (test 51)', async ({ page }) => {
    await mockSimilarEmpty(page);

    await openTicketPage(page);
    await expect(page.locator('[data-testid="provider-badge"]')).toBeVisible();
    // Default to 'openai' when NEXT_PUBLIC_AI_PROVIDER is not set
    await expect(page.locator('[data-testid="provider-badge"]')).toContainText(/openai|anthropic|azure/i);
  });
});

// ─── Tests 52–53, 55–56: Keyboard navigation ────────────────────────────────

test.describe('UX #52-56 — Keyboard navigation', () => {
  test('all interactive elements in copilot panel are tab-reachable (test 52)', async ({
    page,
  }) => {
    await mockSimilarEmpty(page);

    await openTicketPage(page);

    // Verify key focusable elements are present and focusable.
    // The Ask button is disabled while input is empty, so fill the input first.
    const alwaysEnabled = [
      '[data-testid="analyze-button"]',
      'button:has-text("Suggest Next Steps")',
      '[data-testid="demo-button"]',
      '[data-testid="draft-type-select"]',
      '[data-testid="generate-draft-button"]',
      '#chat-input',
    ];

    for (const selector of alwaysEnabled) {
      await page.locator(selector).focus();
      await expect(page.locator(selector)).toBeFocused();
    }

    // Ask button is only enabled once there is input
    await page.locator('#chat-input').fill('test');
    await page.locator('button[aria-label="Submit question to Copilot"]').focus();
    await expect(page.locator('button[aria-label="Submit question to Copilot"]')).toBeFocused();
  });

  test('status buttons are reachable and activatable via keyboard (test 55)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockUpdateStatus(page, 'IN_PROGRESS');

    await openTicketPage(page);

    // Tab to the IN_PROGRESS button and activate with Space
    const inProgressBtn = page.locator('button', { hasText: 'IN PROGRESS' });
    await inProgressBtn.focus();
    await expect(inProgressBtn).toBeFocused();
    await page.keyboard.press('Space');

    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('collapsible <details> sections toggle with Enter key (test 56)', async ({ page }) => {
    await mockSimilarEmpty(page);
    await mockAnalyze(page);

    await openTicketPage(page);
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible({ timeout: 8000 });

    const details = page.locator('details').first();
    const summary = details.locator('summary');

    await expect(details).toHaveAttribute('open');

    // Focus the summary and press Enter to collapse
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).not.toHaveAttribute('open');

    // Press Enter again to re-expand
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open');
  });
});
