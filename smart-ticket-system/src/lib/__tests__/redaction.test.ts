import { describe, it, expect } from 'vitest';
import { redactSensitiveData, redactTicketSnapshot } from '../redaction';
import type { TicketSnapshot } from '../crmClient';

describe('redactSensitiveData', () => {
  it('redacts email addresses', () => {
    const text = 'Contact us at support@example.com for help';
    const result = redactSensitiveData(text);

    expect(result.redactedText).toBe('Contact us at [EMAIL_REDACTED] for help');
    expect(result.hasRedactions).toBe(true);
    expect(result.redactionCount).toBe(1);
  });

  it('redacts multiple emails', () => {
    const text = 'From: alice@example.com, To: bob@company.org';
    const result = redactSensitiveData(text);

    expect(result.redactedText).not.toContain('alice@example.com');
    expect(result.redactedText).not.toContain('bob@company.org');
    expect(result.redactionCount).toBe(2);
  });

  it('redacts Bearer tokens', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = redactSensitiveData(text);

    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.hasRedactions).toBe(true);
  });

  it('redacts GitHub personal access tokens', () => {
    // ghp_ followed by exactly 36 alphanumeric chars (real GitHub PAT format)
    const text = 'Use token ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA to authenticate';
    const result = redactSensitiveData(text);

    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.redactedText).not.toContain('ghp_');
    expect(result.hasRedactions).toBe(true);
  });

  it('redacts API key patterns with sk_ prefix', () => {
    // sk_ followed by 20+ consecutive alphanumeric chars (no underscores in the key portion)
    const text = 'The API key is sk_abcdefghijklmnopqrstuvwxyz12345';
    const result = redactSensitiveData(text);

    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.hasRedactions).toBe(true);
  });

  it('returns unchanged text with no redactions needed', () => {
    const text = 'This is a normal support ticket with no sensitive data.';
    const result = redactSensitiveData(text);

    expect(result.redactedText).toBe(text);
    expect(result.hasRedactions).toBe(false);
    expect(result.redactionCount).toBe(0);
  });

  it('handles empty string', () => {
    const result = redactSensitiveData('');

    expect(result.redactedText).toBe('');
    expect(result.hasRedactions).toBe(false);
    expect(result.redactionCount).toBe(0);
  });
});

describe('redactTicketSnapshot', () => {
  const baseSnapshot: TicketSnapshot = {
    id: 'ticket-123',
    title: 'Login issue',
    description: 'User alice@example.com cannot log in',
    status: 'OPEN',
    priority: 'HIGH',
    customerName: 'Alice',
    productArea: 'Auth',
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Alice',
        content: 'My email is alice@example.com and I need help',
      },
      {
        authorType: 'AGENT',
        authorName: 'Support',
        content: 'No sensitive data here',
      },
    ],
  };

  it('redacts emails from ticket description', () => {
    const redacted = redactTicketSnapshot(baseSnapshot);

    expect(redacted.description).not.toContain('alice@example.com');
    expect(redacted.description).toContain('[EMAIL_REDACTED]');
  });

  it('redacts emails from all messages', () => {
    const redacted = redactTicketSnapshot(baseSnapshot);

    expect(redacted.messages[0].content).not.toContain('alice@example.com');
    expect(redacted.messages[0].content).toContain('[EMAIL_REDACTED]');
  });

  it('preserves unaffected message content', () => {
    const redacted = redactTicketSnapshot(baseSnapshot);

    expect(redacted.messages[1].content).toBe('No sensitive data here');
  });

  it('preserves non-sensitive ticket fields', () => {
    const redacted = redactTicketSnapshot(baseSnapshot);

    expect(redacted.id).toBe(baseSnapshot.id);
    expect(redacted.title).toBe(baseSnapshot.title);
    expect(redacted.status).toBe(baseSnapshot.status);
    expect(redacted.priority).toBe(baseSnapshot.priority);
    expect(redacted.customerName).toBe(baseSnapshot.customerName);
  });

  it('handles ticket with no sensitive data', () => {
    const clean: TicketSnapshot = {
      ...baseSnapshot,
      description: 'Normal description without sensitive data',
      messages: [
        {
          authorType: 'CUSTOMER',
          authorName: 'Bob',
          content: 'Normal message content',
        },
      ],
    };

    const redacted = redactTicketSnapshot(clean);

    expect(redacted.description).toBe(clean.description);
    expect(redacted.messages[0].content).toBe(clean.messages[0].content);
  });
});
