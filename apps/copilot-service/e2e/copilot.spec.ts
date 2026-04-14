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

  test('draft customer reply: generate → edit → save → reload', async ({
    page,
  }) => {
    const suggestionId = 'cl_draft_customer_1';
    const initialText =
      'Hi there, thanks for reaching out. Here are the next steps: 1. ... 2. ... 3. ...';

    await page.route('**/api/copilot/v1/draft-reply', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { suggestionId, state: 'queued' },
          }),
        });
        return;
      }
      await route.continue();
    });

    let statusCalls = 0;
    const mockContent = {
      text: initialText,
      draftType: 'customer_reply',
      tone: 'professional',
      usedAnalysisId: 'cl_analysis_1',
      markedSent: false,
    };
    await page.route(
      `**/api/copilot/v1/status/${suggestionId}`,
      async (route) => {
        statusCalls++;
        const state = statusCalls >= 2 ? 'success' : 'queued';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state,
              content: state === 'success' ? mockContent : {},
              error: null,
              kind: 'draft_customer_reply',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    let savedText = initialText;
    await page.route(
      `**/api/copilot/v1/draft-reply/${suggestionId}`,
      async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = JSON.parse(route.request().postData() || '{}');
          savedText = body.text;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: suggestionId,
                content: { ...mockContent, text: savedText },
              },
            }),
          });
          return;
        }
        await route.continue();
      },
    );

    await page.goto('/tickets/test-ticket-id');
    await expect(page.locator('[data-testid="copilot-panel"]')).toBeVisible();

    await page.selectOption(
      '[data-testid="draft-type-select"]',
      'customer_reply',
    );
    await page.click('[data-testid="generate-draft-button"]');

    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );

    const textarea = page.locator('[data-testid="draft-edit-textarea"]');
    await expect(textarea).toHaveValue(initialText);
    await expect(
      page.locator('[data-testid="draft-analysis-badge"]'),
    ).toBeVisible();

    const editedText = 'Edited draft text — customer will love this.';
    await textarea.fill(editedText);
    await page.click('[data-testid="draft-save-button"]');
    await expect(
      page.locator('[data-testid="draft-save-button"]'),
    ).toContainText('Saved', { timeout: 3000 });

    await page.click('[data-testid="draft-copy-button"]');

    // Reload: localStorage should point at same id; mock now returns edited text
    mockContent.text = editedText;
    statusCalls = 10; // force success path on next poll
    await page.reload();
    await expect(page.locator('[data-testid="copilot-panel"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="draft-edit-textarea"]'),
    ).toHaveValue(editedText, { timeout: 5000 });
  });

  test('draft internal note: generates with analysis badge', async ({
    page,
  }) => {
    const suggestionId = 'cl_draft_note_1';
    await page.route('**/api/copilot/v1/draft-reply', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { suggestionId, state: 'queued' },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route(
      `**/api/copilot/v1/status/${suggestionId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'success',
              content: {
                text: 'Summary: token expiry issue. Hypotheses: ...',
                draftType: 'internal_note',
                usedAnalysisId: 'cl_analysis_2',
                markedSent: false,
              },
              error: null,
              kind: 'draft_internal_note',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    await page.goto('/tickets/test-ticket-id');
    await page.selectOption(
      '[data-testid="draft-type-select"]',
      'internal_note',
    );
    await page.click('[data-testid="generate-draft-button"]');
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );
    await expect(
      page.locator('[data-testid="draft-analysis-badge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="draft-edit-textarea"]'),
    ).toContainText('Summary');
  });

  test('draft escalation: generates with analysis badge', async ({ page }) => {
    const suggestionId = 'cl_draft_esc_1';
    await page.route('**/api/copilot/v1/draft-reply', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { suggestionId, state: 'queued' },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route(
      `**/api/copilot/v1/status/${suggestionId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'success',
              content: {
                text: 'Summary: ...\nReproduction Steps: ...\nEnvironment: ...\nAsk: fix infra.',
                draftType: 'escalation',
                usedAnalysisId: 'cl_analysis_3',
                markedSent: false,
              },
              error: null,
              kind: 'draft_escalation',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    await page.goto('/tickets/test-ticket-id');
    await page.selectOption('[data-testid="draft-type-select"]', 'escalation');
    await page.click('[data-testid="generate-draft-button"]');
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );
    await expect(
      page.locator('[data-testid="draft-analysis-badge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="draft-edit-textarea"]'),
    ).toContainText('Reproduction Steps');
  });

  test('analyze shows References section with KB results', async ({ page }) => {
    const suggestionId = 'test-ref-suggestion';

    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { suggestionId, state: 'queued' },
        }),
      });
    });

    await page.route(
      `**/api/copilot/v1/status/${suggestionId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'success',
              content: {
                extractedSignals: { errorStrings: [], urls: [] },
                hypotheses: [],
                clarifyingQuestions: [],
                nextSteps: [],
                riskFlags: [],
                escalationWhen: [],
                references: [
                  {
                    id: 'kb_1',
                    title: 'How to Reset Your Password',
                    url: 'https://help.example.com/password-reset',
                    snippet:
                      'Navigate to the login page and click Forgot Password...',
                    score: 0.92,
                  },
                  {
                    id: 'kb_2',
                    title: 'Troubleshooting API Rate Limits',
                    url: null,
                    snippet: 'If you receive a 429 error, implement backoff...',
                    score: 0.78,
                  },
                ],
              },
              error: null,
              kind: 'analysis',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    await page.goto('/tickets/test-ticket-id');
    await page.click('[data-testid="analyze-button"]');

    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );

    // References section should be visible
    await expect(
      page.locator('[data-testid="references-section"]'),
    ).toBeVisible();

    // Should show both reference items
    const items = page.locator('[data-testid="reference-item"]');
    await expect(items).toHaveCount(2);

    // First reference has a link
    await expect(
      items.first().locator('a[href="https://help.example.com/password-reset"]'),
    ).toBeVisible();
    await expect(items.first()).toContainText('How to Reset Your Password');
    await expect(items.first()).toContainText('92%');

    // Second reference has no link (url is null)
    await expect(items.nth(1)).toContainText(
      'Troubleshooting API Rate Limits',
    );
    await expect(items.nth(1)).toContainText('78%');
  });

  test('analyze -> poll -> render -> feedback act', async ({ page }) => {
    const suggestionId = 'test-feedback-flow';

    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { suggestionId, state: 'queued' },
        }),
      });
    });

    await page.route(
      `**/api/copilot/v1/status/${suggestionId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: suggestionId,
              state: 'success',
              content: {
                extractedSignals: { errorStrings: [], urls: [] },
                hypotheses: [
                  {
                    cause: 'Token expiry',
                    evidence: ['401 on refresh'],
                    confidence: 0.8,
                    tests: ['Replay with fresh token'],
                  },
                ],
                clarifyingQuestions: [],
                nextSteps: ['Refresh credentials'],
                riskFlags: [],
                escalationWhen: [],
                references: [],
              },
              error: null,
              kind: 'analysis',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    let feedbackBody: Record<string, unknown> | null = null;
    await page.route('**/api/copilot/v1/feedback', async (route) => {
      if (route.request().method() === 'POST') {
        feedbackBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { id: 'fb_1' } }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/tickets/test-ticket-id');
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );

    // Act: rate the suggestion up
    const upBtn = page.locator('[data-testid="feedback-up"]').first();
    if (await upBtn.count()) {
      await upBtn.click();
      await expect.poll(() => feedbackBody?.rating).toBe('up');
      expect(feedbackBody?.suggestionId).toBe(suggestionId);
    }
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
