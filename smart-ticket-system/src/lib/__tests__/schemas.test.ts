import { describe, it, expect } from 'vitest';
import {
  AnalysisResultSchema,
  NextStepsResultSchema,
  DraftReplyResultSchema,
  ChatResultSchema,
  AnalyzeRequestSchema,
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
