import { describe, it, expect } from 'vitest';
import { FeedbackRequestSchema } from '../schemas';

describe('FeedbackRequestSchema', () => {
  it('accepts valid up rating', () => {
    const result = FeedbackRequestSchema.safeParse({
      suggestionId: 'sug_1',
      rating: 'up',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid down rating with comment', () => {
    const result = FeedbackRequestSchema.safeParse({
      suggestionId: 'sug_1',
      rating: 'down',
      comment: 'Missed the platform detail',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', () => {
    const result = FeedbackRequestSchema.safeParse({
      suggestionId: 'sug_1',
      rating: 'meh',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing suggestionId', () => {
    const result = FeedbackRequestSchema.safeParse({ rating: 'up' });
    expect(result.success).toBe(false);
  });

  it('rejects comment over 1000 chars', () => {
    const result = FeedbackRequestSchema.safeParse({
      suggestionId: 'sug_1',
      rating: 'up',
      comment: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
