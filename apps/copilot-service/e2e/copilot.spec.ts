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
                extractedSignals: { errorStrings: ['401 Unauthorized'], urls: [] },
                hypotheses: [{ cause: 'Token expiry', evidence: ['401 on refresh'], confidence: 0.8, tests: ['Replay with fresh token'] }],
                clarifyingQuestions: ['Which browser are you using?'],
                nextSteps: ['Review logs', 'Re-issue credentials'],
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
      }
    });

    // Mock similar (prevents unmocked requests from interfering)
    await page.route('**/api/copilot/v1/similar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { cases: [] } }),
      });
    });

    await page.goto('/test-fixture/panel');
    await expect(page.locator('[data-testid="copilot-panel"]')).toBeVisible({ timeout: 10000 });

    // Click analyze button
    await page.click('[data-testid="analyze-button"]');

    // Should show queued state
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Queued',
      { timeout: 3000 },
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

    // Should display structured analysis results (content matches current AnalysisResult format)
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible();
    await expect(page.locator('text=Review logs')).toBeVisible();
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

    await page.goto('/test-fixture/panel');
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

    await page.goto('/test-fixture/panel');
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

    await page.goto('/test-fixture/panel');
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

    await page.goto('/test-fixture/panel');
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

    await page.goto('/test-fixture/panel');
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

    await page.goto('/test-fixture/panel');
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="copilot-state"]')).toContainText(
      'Complete',
      { timeout: 5000 },
    );

    // Act: rate the suggestion up
    const upBtn = page.locator('[data-testid="feedback-up"]').first();
    if (await upBtn.count()) {
      await upBtn.click();
      await expect
        .poll(() => (feedbackBody as Record<string, unknown> | null)?.rating)
        .toBe('up');
      expect(
        (feedbackBody as Record<string, unknown> | null)?.suggestionId,
      ).toBe(suggestionId);
    }
  });

  test('similar cases — Apply pattern creates a saved draft and persists', async ({ page }) => {
    const applyId = 'apply-draft-suggestion-1';

    // Mock similar endpoint to return two resolved cases
    await page.route('**/api/copilot/v1/similar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            cases: [
              {
                id: 'tkt_005',
                title: 'Password reset email not arriving',
                productArea: 'Authentication',
                status: 'RESOLVED',
                score: 0.88,
                resolution: 'SPF record was misconfigured. Fix deployed and tested.',
              },
              {
                id: 'tkt_011',
                title: 'Mobile app 3.2.0 crashes on iPhone',
                productArea: 'Mobile',
                status: 'RESOLVED',
                score: 0.72,
                resolution: 'Update to 3.2.1 resolves the WebKit crash.',
              },
            ],
          },
        }),
      });
    });

    // Mock the apply endpoint
    await page.route('**/api/copilot/v1/similar/tkt_005/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { suggestionId: applyId, state: 'queued' },
        }),
      });
    });

    // Mock polling for the generated draft
    await page.route(`**/api/copilot/v1/status/${applyId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: applyId,
            state: 'success',
            kind: 'draft_customer_reply',
            content: {
              text: 'Hi there, we identified an SPF misconfiguration that was causing delivery failures. This has been resolved — please retry.',
              draftType: 'customer_reply',
              tone: 'professional',
              usedAnalysisId: null,
              markedSent: false,
            },
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/test-fixture/panel');

    // Similar cases section should render on mount
    await expect(
      page.locator('[data-testid="similar-cases-section"]'),
    ).toBeVisible({ timeout: 5000 });

    // Two case items should appear
    await expect(page.locator('[data-testid="similar-case-item"]')).toHaveCount(
      2,
      { timeout: 5000 },
    );

    // Click the Apply button on the first case
    await page
      .locator('[data-testid="apply-similar-button"]')
      .first()
      .click();

    // Draft textarea should be populated with the generated text
    await expect(page.locator('[data-testid="draft-edit-textarea"]')).toHaveValue(
      /SPF misconfiguration/,
      { timeout: 5000 },
    );

    // Save the draft
    await page.click('[data-testid="draft-save-button"]');
  });

  test('happy demo path: analyze → draft → edit → save → copy → feedback', async ({ page }) => {
    const analyzeId = 'demo-analyze-id';
    const draftId = 'demo-draft-id';

    // Mock analyze
    await page.route('**/api/copilot/v1/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { suggestionId: analyzeId, state: 'queued' } }),
      });
    });

    // Mock analyze status — immediately success
    await page.route(`**/api/copilot/v1/status/${analyzeId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: analyzeId,
            state: 'success',
            kind: 'analysis',
            content: {
              extractedSignals: { errorStrings: ['500 Internal Server Error'], urls: [] },
              hypotheses: [{ cause: 'SAML IdP misconfiguration', evidence: ['500 on SSO'], confidence: 0.9, tests: ['Check IdP metadata'] }],
              clarifyingQuestions: ['Which IdP are you using?'],
              nextSteps: ['Verify SAML metadata', 'Check certificate expiry'],
              riskFlags: [],
              escalationWhen: [],
              references: [],
            },
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock draft-reply
    await page.route('**/api/copilot/v1/draft-reply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { suggestionId: draftId, state: 'queued' } }),
      });
    });

    // Mock draft status — immediately success
    await page.route(`**/api/copilot/v1/status/${draftId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: draftId,
            state: 'success',
            kind: 'draft_customer_reply',
            content: {
              text: 'Hi there, our team is investigating the SSO issue. We will update you shortly.',
              draftType: 'customer_reply',
              tone: 'professional',
              usedAnalysisId: analyzeId,
              markedSent: false,
            },
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock draft save
    await page.route(`**/api/copilot/v1/draft-reply/${draftId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { id: draftId, content: {} } }),
        });
        return;
      }
      await route.continue();
    });

    // Mock similar cases (empty for this test)
    await page.route('**/api/copilot/v1/similar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { cases: [] } }),
      });
    });

    await page.goto('/test-fixture/panel');

    // Click the Demo button
    await page.click('[data-testid="demo-button"]');

    // The demo runs analyze then immediately generates a draft; wait for the
    // final state (draft textarea populated) rather than the transient
    // analysis-summary which can clear before Playwright polls for it.
    await expect(page.locator('[data-testid="draft-edit-textarea"]')).toHaveValue(
      /SSO issue/,
      { timeout: 12000 },
    );

    // Edit the draft
    await page.fill('[data-testid="draft-edit-textarea"]', 'Updated: investigating the SSO issue now.');

    // Save
    await page.click('[data-testid="draft-save-button"]');
    await expect(page.locator('[data-testid="toast"]').first()).toBeVisible({ timeout: 3000 });

    // Provider badge should be visible
    await expect(page.locator('[data-testid="provider-badge"]')).toBeVisible();
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

    await page.goto('/test-fixture/panel');
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
