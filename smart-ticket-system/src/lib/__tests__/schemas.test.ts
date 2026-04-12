import { describe, it, expect } from 'vitest';
import {
  AnalysisResultSchema,
  NextStepsResultSchema,
  DraftReplyResultSchema,
  ChatResultSchema,
  AnalyzeRequestSchema,
  DraftGenerateRequestSchema,
  DraftSaveRequestSchema,
  DraftCustomerReplyResultSchema,
  DraftInternalNoteResultSchema,
  DraftEscalationResultSchema,
  KBReferenceSchema,
} from '../schemas';

describe('AnalysisResultSchema', () => {
  const validMinimal = {
    extractedSignals: {
      errorStrings: [],
      urls: [],
    },
    hypotheses: [],
    clarifyingQuestions: [],
    nextSteps: [],
    riskFlags: [],
    escalationWhen: [],
  };

  const validFull = {
    extractedSignals: {
      product: 'Acme CRM',
      platform: 'web',
      os: 'macOS 14',
      browser: 'Chrome 120',
      appVersion: '2.4.1',
      device: 'Desktop',
      errorStrings: ['TypeError: Cannot read property of undefined'],
      urls: ['https://app.example.com/dashboard'],
    },
    hypotheses: [
      {
        cause: 'Session token expired before UI refresh',
        evidence: ['User reports logging out unexpectedly'],
        confidence: 0.8,
        tests: ['Ask user to reproduce after clearing cookies'],
      },
    ],
    clarifyingQuestions: ['How long has this been occurring?'],
    nextSteps: ['Check auth logs for token expiry events'],
    riskFlags: ['Customer is on enterprise plan'],
    escalationWhen: ['Issue affects more than one user in the organization'],
  };

  it('validates a minimal result with empty arrays', () => {
    expect(AnalysisResultSchema.safeParse(validMinimal).success).toBe(true);
  });

  it('validates a fully populated result', () => {
    expect(AnalysisResultSchema.safeParse(validFull).success).toBe(true);
  });

  it('validates with optional signal fields omitted', () => {
    const data = {
      ...validMinimal,
      extractedSignals: { errorStrings: ['404 Not Found'], urls: [] },
    };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(true);
  });

  it('preserves optional signal field values when present', () => {
    const result = AnalysisResultSchema.safeParse(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extractedSignals.product).toBe('Acme CRM');
      expect(result.data.extractedSignals.browser).toBe('Chrome 120');
    }
  });

  it('rejects when extractedSignals is missing', () => {
    const { extractedSignals: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when errorStrings is missing from extractedSignals', () => {
    const data = { ...validMinimal, extractedSignals: { urls: [] } };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when urls is missing from extractedSignals', () => {
    const data = { ...validMinimal, extractedSignals: { errorStrings: [] } };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when hypotheses array is missing', () => {
    const { hypotheses: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a hypothesis with confidence below 0', () => {
    const data = {
      ...validFull,
      hypotheses: [{ cause: 'test', evidence: [], confidence: -0.1, tests: [] }],
    };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a hypothesis with confidence above 1', () => {
    const data = {
      ...validFull,
      hypotheses: [{ cause: 'test', evidence: [], confidence: 1.5, tests: [] }],
    };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(false);
  });

  it('accepts confidence exactly at 0 and 1 boundaries', () => {
    const withZero = { ...validFull, hypotheses: [{ cause: 'test', evidence: [], confidence: 0, tests: [] }] };
    const withOne = { ...validFull, hypotheses: [{ cause: 'test', evidence: [], confidence: 1, tests: [] }] };
    expect(AnalysisResultSchema.safeParse(withZero).success).toBe(true);
    expect(AnalysisResultSchema.safeParse(withOne).success).toBe(true);
  });

  it('rejects a hypothesis missing the cause field', () => {
    const data = {
      ...validFull,
      hypotheses: [{ evidence: ['some evidence'], confidence: 0.5, tests: ['a test'] }],
    };
    expect(AnalysisResultSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when clarifyingQuestions is missing', () => {
    const { clarifyingQuestions: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when nextSteps is missing', () => {
    const { nextSteps: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when riskFlags is missing', () => {
    const { riskFlags: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when escalationWhen is missing', () => {
    const { escalationWhen: _, ...rest } = validFull;
    expect(AnalysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it('validates multiple hypotheses', () => {
    const data = {
      ...validFull,
      hypotheses: [
        { cause: 'Cause A', evidence: ['ev1'], confidence: 0.9, tests: ['t1'] },
        { cause: 'Cause B', evidence: [], confidence: 0.3, tests: [] },
      ],
    };
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hypotheses).toHaveLength(2);
  });
});

describe('NextStepsResultSchema', () => {
  it('validates correct steps', () => {
    const valid = {
      steps: ['Contact customer', 'Check logs', 'Escalate to engineering'],
    };

    const result = NextStepsResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty steps array', () => {
    const invalid = {
      steps: [],
    };

    const result = NextStepsResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects too many steps', () => {
    const invalid = {
      steps: ['a', 'b', 'c', 'd', 'e', 'f'],
    };

    const result = NextStepsResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects step over max length', () => {
    const invalid = {
      steps: ['a'.repeat(201)],
    };

    const result = NextStepsResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('DraftReplyResultSchema', () => {
  it('validates correct draft reply', () => {
    const valid = {
      reply: 'Thank you for contacting support. We will help you resolve this issue.',
    };

    const result = DraftReplyResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty reply', () => {
    const invalid = {
      reply: '',
    };

    const result = DraftReplyResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects reply over max length', () => {
    const invalid = {
      reply: 'a'.repeat(2001),
    };

    const result = DraftReplyResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ChatResultSchema', () => {
  it('validates correct chat result', () => {
    const valid = {
      answer: 'The ticket is related to a login issue with the API.',
    };

    const result = ChatResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty answer', () => {
    const invalid = {
      answer: '',
    };

    const result = ChatResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('DraftGenerateRequestSchema', () => {
  const validId = 'clabcdef1234567890';

  it('validates a customer_reply request with tone', () => {
    expect(
      DraftGenerateRequestSchema.safeParse({
        ticketId: validId,
        draftType: 'customer_reply',
        tone: 'friendly',
      }).success,
    ).toBe(true);
  });

  it('defaults tone to professional when omitted', () => {
    const r = DraftGenerateRequestSchema.safeParse({
      ticketId: validId,
      draftType: 'internal_note',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tone).toBe('professional');
  });

  it('rejects unknown draftType', () => {
    expect(
      DraftGenerateRequestSchema.safeParse({
        ticketId: validId,
        draftType: 'unknown',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid ticketId cuid', () => {
    expect(
      DraftGenerateRequestSchema.safeParse({
        ticketId: 'not-a-cuid',
        draftType: 'customer_reply',
      }).success,
    ).toBe(false);
  });
});

describe('DraftSaveRequestSchema', () => {
  it('accepts text only', () => {
    expect(DraftSaveRequestSchema.safeParse({ text: 'hello' }).success).toBe(
      true,
    );
  });
  it('accepts text with markedSent', () => {
    expect(
      DraftSaveRequestSchema.safeParse({ text: 'hello', markedSent: true })
        .success,
    ).toBe(true);
  });
  it('rejects empty text', () => {
    expect(DraftSaveRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });
});

describe('DraftCustomerReplyResultSchema', () => {
  const validResult = {
    text: 'Thanks for reaching out. Here are the next steps...',
    draftType: 'customer_reply' as const,
    tone: 'professional',
    usedAnalysisId: 'cl_test_analysis',
    markedSent: false,
  };

  it('validates a correct customer reply result', () => {
    expect(DraftCustomerReplyResultSchema.safeParse(validResult).success).toBe(
      true,
    );
  });

  it('allows usedAnalysisId to be null', () => {
    expect(
      DraftCustomerReplyResultSchema.safeParse({
        ...validResult,
        usedAnalysisId: null,
      }).success,
    ).toBe(true);
  });

  it('rejects text over 2000 characters', () => {
    expect(
      DraftCustomerReplyResultSchema.safeParse({
        ...validResult,
        text: 'a'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('rejects empty text', () => {
    expect(
      DraftCustomerReplyResultSchema.safeParse({ ...validResult, text: '' })
        .success,
    ).toBe(false);
  });

  it('rejects missing text field', () => {
    const { text: _t, ...rest } = validResult;
    expect(DraftCustomerReplyResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects wrong draftType literal', () => {
    expect(
      DraftCustomerReplyResultSchema.safeParse({
        ...validResult,
        draftType: 'internal_note',
      }).success,
    ).toBe(false);
  });

  it('defaults markedSent to false when omitted', () => {
    const { markedSent: _m, ...rest } = validResult;
    const r = DraftCustomerReplyResultSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.markedSent).toBe(false);
  });
});

describe('DraftInternalNoteResultSchema', () => {
  it('accepts valid internal note', () => {
    expect(
      DraftInternalNoteResultSchema.safeParse({
        text: 'Summary: ...',
        draftType: 'internal_note',
        usedAnalysisId: null,
        markedSent: false,
      }).success,
    ).toBe(true);
  });

  it('rejects text over 5000 characters', () => {
    expect(
      DraftInternalNoteResultSchema.safeParse({
        text: 'a'.repeat(5001),
        draftType: 'internal_note',
        usedAnalysisId: null,
      }).success,
    ).toBe(false);
  });
});

describe('DraftEscalationResultSchema', () => {
  it('accepts valid escalation', () => {
    expect(
      DraftEscalationResultSchema.safeParse({
        text: 'Summary: ...',
        draftType: 'escalation',
        usedAnalysisId: null,
        markedSent: false,
      }).success,
    ).toBe(true);
  });

  it('rejects wrong draftType literal', () => {
    expect(
      DraftEscalationResultSchema.safeParse({
        text: 'x',
        draftType: 'customer_reply',
        usedAnalysisId: null,
      }).success,
    ).toBe(false);
  });
});

describe('KBReferenceSchema', () => {
  const validRef = {
    id: 'kb_123',
    title: 'How to Reset Password',
    url: 'https://help.example.com/password',
    snippet: 'Navigate to the login page and click Forgot Password...',
    score: 0.85,
  };

  it('validates a correct reference', () => {
    expect(KBReferenceSchema.safeParse(validRef).success).toBe(true);
  });

  it('accepts null url', () => {
    expect(
      KBReferenceSchema.safeParse({ ...validRef, url: null }).success,
    ).toBe(true);
  });

  it('rejects missing title', () => {
    const { title: _t, ...rest } = validRef;
    expect(KBReferenceSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing snippet', () => {
    const { snippet: _s, ...rest } = validRef;
    expect(KBReferenceSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects score above 1', () => {
    expect(
      KBReferenceSchema.safeParse({ ...validRef, score: 1.5 }).success,
    ).toBe(false);
  });

  it('rejects score below 0', () => {
    expect(
      KBReferenceSchema.safeParse({ ...validRef, score: -0.1 }).success,
    ).toBe(false);
  });
});

describe('AnalysisResultSchema with references', () => {
  const baseAnalysis = {
    extractedSignals: { errorStrings: [], urls: [] },
    hypotheses: [],
    clarifyingQuestions: [],
    nextSteps: [],
    riskFlags: [],
    escalationWhen: [],
  };

  it('defaults references to empty array when omitted', () => {
    const r = AnalysisResultSchema.safeParse(baseAnalysis);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.references).toEqual([]);
  });

  it('accepts analysis with references', () => {
    const r = AnalysisResultSchema.safeParse({
      ...baseAnalysis,
      references: [
        {
          id: 'kb_1',
          title: 'Test Article',
          url: null,
          snippet: 'Some snippet',
          score: 0.9,
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.references).toHaveLength(1);
  });
});

describe('NextStepsResultSchema with references', () => {
  it('defaults references to empty array when omitted', () => {
    const r = NextStepsResultSchema.safeParse({ steps: ['Step one'] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.references).toEqual([]);
  });

  it('accepts steps with references', () => {
    const r = NextStepsResultSchema.safeParse({
      steps: ['Step one'],
      references: [
        {
          id: 'kb_2',
          title: 'Guide',
          url: 'https://example.com',
          snippet: 'snippet',
          score: 0.75,
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.references).toHaveLength(1);
  });
});

describe('AnalyzeRequestSchema', () => {
  it('validates correct request', () => {
    const valid = {
      ticketId: 'clabcdef1234567890',
    };

    const result = AnalyzeRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid cuid', () => {
    const invalid = {
      ticketId: 'not-a-cuid',
    };

    const result = AnalyzeRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
