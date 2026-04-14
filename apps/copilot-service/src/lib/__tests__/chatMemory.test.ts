import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const createMock = vi.fn();

vi.mock('../prisma', () => ({
  prisma: {
    aIConversation: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      deleteMany: vi.fn(),
    },
  },
}));

import { loadConversation, appendChatTurn } from '../chatMemory';

describe('chatMemory', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
  });

  it('loadConversation returns [] when no row', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const result = await loadConversation('ticket-1');
    expect(result).toEqual([]);
  });

  it('loadConversation returns message array', async () => {
    const messages = [{ role: 'user', content: 'hi' }];
    findFirstMock.mockResolvedValueOnce({ id: 'c1', messages });
    const result = await loadConversation('ticket-1');
    expect(result).toEqual(messages);
  });

  it('appendChatTurn creates a new row when none exists', async () => {
    findFirstMock.mockResolvedValue(null);
    await appendChatTurn('ticket-1', [{ role: 'user', content: 'hi' }]);
    expect(createMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('appendChatTurn updates existing row and appends', async () => {
    findFirstMock
      .mockResolvedValueOnce({ id: 'c1', messages: [{ role: 'user', content: 'prev' }] })
      .mockResolvedValueOnce({ id: 'c1' });
    await appendChatTurn('ticket-1', [{ role: 'assistant', content: 'new' }]);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        messages: [
          { role: 'user', content: 'prev' },
          { role: 'assistant', content: 'new' },
        ],
      },
    });
  });

  it('appendChatTurn caps at 40 stored turns', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }));
    findFirstMock
      .mockResolvedValueOnce({ id: 'c1', messages: many })
      .mockResolvedValueOnce({ id: 'c1' });
    await appendChatTurn('ticket-1', [{ role: 'assistant', content: 'reply' }]);
    const stored = updateMock.mock.calls[0][0].data.messages;
    expect(stored.length).toBe(40);
    expect(stored[stored.length - 1]).toEqual({ role: 'assistant', content: 'reply' });
  });
});
