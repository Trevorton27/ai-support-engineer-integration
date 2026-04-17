import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock('../embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

import { searchSimilarTickets, buildTicketEmbeddingText } from '../ticketEmbeddings';
import { prisma } from '../prisma';

const mockQuery = vi.mocked(prisma.$queryRawUnsafe);
const mockExec = vi.mocked(prisma.$executeRawUnsafe);

beforeEach(() => {
  vi.clearAllMocks();
  mockExec.mockResolvedValue(1);
});

describe('buildTicketEmbeddingText', () => {
  it('concatenates title and description', () => {
    const result = buildTicketEmbeddingText('Login fails', 'Error on Chrome');
    expect(result).toBe('Login fails\n\nError on Chrome');
  });

  it('truncates long text to 8000 chars', () => {
    const long = 'x'.repeat(10000);
    const result = buildTicketEmbeddingText('T', long);
    expect(result.length).toBeLessThanOrEqual(8000);
  });
});

describe('searchSimilarTickets', () => {
  const mockRows = [
    {
      id: 'tkt_001',
      title: 'SSO login fails with Chrome',
      productArea: 'Authentication',
      status: 'RESOLVED',
      score: 0.92,
      resolution: 'Updated SPF record fixed the issue.',
    },
    {
      id: 'tkt_005',
      title: 'Password reset email not arriving',
      productArea: 'Authentication',
      status: 'RESOLVED',
      score: 0.78,
      resolution: 'SPF misconfiguration was root cause.',
    },
  ];

  it('returns cases sorted by score from the DB', async () => {
    mockQuery.mockResolvedValue(mockRows);

    const results = await searchSimilarTickets('SSO login error');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('tkt_001');
    expect(results[0].score).toBe(0.92);
  });

  it('filters results below the 0.65 minimum score threshold', async () => {
    mockQuery.mockResolvedValue([
      { ...mockRows[0], score: 0.80 },
      { ...mockRows[1], score: 0.50 }, // below threshold
    ]);

    const results = await searchSimilarTickets('login issue');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tkt_001');
  });

  it('maps null resolution correctly', async () => {
    mockQuery.mockResolvedValue([{ ...mockRows[0], resolution: null }]);

    const results = await searchSimilarTickets('test');
    expect(results[0].resolution).toBeNull();
  });

  it('returns empty array when no matches', async () => {
    mockQuery.mockResolvedValue([]);

    const results = await searchSimilarTickets('totally obscure query');
    expect(results).toEqual([]);
  });

  it('passes excludeTicketId as second parameter', async () => {
    mockQuery.mockResolvedValue([]);

    await searchSimilarTickets('query', { excludeTicketId: 'tkt_abc' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String), // vectorStr
      'tkt_abc',          // excludeId
      null,               // productArea
      5,                  // limit
    );
  });

  it('passes productArea filter correctly', async () => {
    mockQuery.mockResolvedValue([]);

    await searchSimilarTickets('billing error', { productArea: 'Billing' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      null,       // no excludeId
      'Billing',  // productArea
      5,
    );
  });
});
