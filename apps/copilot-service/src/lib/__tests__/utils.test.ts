import { describe, it, expect } from 'vitest';
import { formatTicketId, getPriorityColor, getStatusLabel } from '../utils';

describe('formatTicketId', () => {
  it('formats a cuid-like id into TKT-XXXX', () => {
    expect(formatTicketId('clx1abc1234')).toBe('TKT-1234');
  });

  it('uppercases the suffix', () => {
    expect(formatTicketId('abc_defg')).toBe('TKT-DEFG');
  });
});

describe('getPriorityColor', () => {
  it('returns red for CRITICAL', () => {
    expect(getPriorityColor('CRITICAL')).toBe('text-red-600');
  });

  it('returns orange for HIGH', () => {
    expect(getPriorityColor('HIGH')).toBe('text-orange-500');
  });

  it('returns gray for unknown priority', () => {
    expect(getPriorityColor('UNKNOWN')).toBe('text-gray-500');
  });
});

describe('getStatusLabel', () => {
  it('returns human-readable label for IN_PROGRESS', () => {
    expect(getStatusLabel('IN_PROGRESS')).toBe('In Progress');
  });
});
