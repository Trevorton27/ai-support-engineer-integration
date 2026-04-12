import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

// Mock embeddings
vi.mock('../embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

import { searchKnowledgeBase } from '../kbRetrieval';
import { prisma } from '../prisma';

const mockQuery = vi.mocked(prisma.$queryRawUnsafe);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchKnowledgeBase', () => {
  it('returns references sorted by score from DB', async () => {
    mockQuery.mockResolvedValue([
      { id: 'kb_1', title: 'Article A', url: null, snippet: 'snippet A', score: 0.95 },
      { id: 'kb_2', title: 'Article B', url: 'https://example.com', snippet: 'snippet B', score: 0.82 },
    ]);

    const results = await searchKnowledgeBase('login issue');
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Article A');
    expect(results[1].title).toBe('Article B');
  });

  it('filters results below the minimum score threshold (0.7)', async () => {
    mockQuery.mockResolvedValue([
      { id: 'kb_1', title: 'Good Match', url: null, snippet: 'good', score: 0.85 },
      { id: 'kb_2', title: 'Poor Match', url: null, snippet: 'poor', score: 0.55 },
    ]);

    const results = await searchKnowledgeBase('test query');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Good Match');
  });

  it('passes productArea filter to the query', async () => {
    mockQuery.mockResolvedValue([]);

    await searchKnowledgeBase('billing help', { productArea: 'Billing' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Billing',
      5,
    );
  });

  it('passes null productArea when not specified', async () => {
    mockQuery.mockResolvedValue([]);

    await searchKnowledgeBase('general question');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      null,
      5,
    );
  });

  it('respects custom limit option', async () => {
    mockQuery.mockResolvedValue([]);

    await searchKnowledgeBase('search query', { limit: 3 });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      null,
      3,
    );
  });

  it('returns empty array when no matches', async () => {
    mockQuery.mockResolvedValue([]);

    const results = await searchKnowledgeBase('obscure query');
    expect(results).toEqual([]);
  });
});
