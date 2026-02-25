import { describe, it, expect } from 'vitest';
import {
  AnalysisResultSchema,
  NextStepsResultSchema,
  DraftReplyResultSchema,
  ChatResultSchema,
  AnalyzeRequestSchema,
} from '../schemas';

describe('AnalysisResultSchema', () => {
  it('validates correct analysis result', () => {
    const valid = {
      summary: 'User cannot login to the application',
      sentiment: 'negative',
      category: 'technical',
    };

    const result = AnalysisResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('validates with optional fields', () => {
    const valid = {
      summary: 'Feature request for dark mode',
      sentiment: 'positive',
      category: 'feature-request',
      urgency: 'low',
      suggestedActions: ['Review feasibility', 'Add to backlog'],
    };

    const result = AnalysisResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid sentiment', () => {
    const invalid = {
      summary: 'Test',
      sentiment: 'happy',
      category: 'technical',
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const invalid = {
      summary: 'Test',
      sentiment: 'neutral',
      category: 'unknown',
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects summary over max length', () => {
    const invalid = {
      summary: 'a'.repeat(501),
      sentiment: 'neutral',
      category: 'other',
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty summary', () => {
    const invalid = {
      summary: '',
      sentiment: 'neutral',
      category: 'technical',
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects too many suggested actions', () => {
    const invalid = {
      summary: 'Test',
      sentiment: 'neutral',
      category: 'technical',
      suggestedActions: ['a', 'b', 'c', 'd', 'e', 'f'],
    };

    const result = AnalysisResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
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
