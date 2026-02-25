import { describe, it, expect } from 'vitest';
import { redactSensitiveData, redactTicketSnapshot } from '../redaction';

describe('redactSensitiveData', () => {
  it('redacts email addresses', () => {
    const result = redactSensitiveData('Contact user@example.com for help');
    expect(result.redactedText).toBe('Contact [EMAIL_REDACTED] for help');
    expect(result.hasRedactions).toBe(true);
    expect(result.redactionCount).toBe(1);
  });

  it('redacts multiple emails', () => {
    const result = redactSensitiveData(
      'Email john@example.com or jane@test.org',
    );
    expect(result.redactedText).toBe('Email [EMAIL_REDACTED] or [EMAIL_REDACTED]');
    expect(result.hasRedactions).toBe(true);
    expect(result.redactionCount).toBe(2);
  });

  it('redacts API keys with sk_ prefix', () => {
    const result = redactSensitiveData(
      'API key: sk_EXAMPLE_1234567890abcdef1234567890',
    );
    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.hasRedactions).toBe(true);
  });

  it('redacts Bearer tokens', () => {
    const result = redactSensitiveData('Authorization: Bearer abc123def456');
    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.hasRedactions).toBe(true);
  });

  it('redacts GitHub tokens', () => {
    const result = redactSensitiveData(
      'Token: ghp_1234567890abcdefghijklmnopqrstuv123456',
    );
    expect(result.redactedText).toContain('[TOKEN_REDACTED]');
    expect(result.hasRedactions).toBe(true);
  });

  it('handles text with no sensitive data', () => {
    const result = redactSensitiveData('This is clean text');
    expect(result.redactedText).toBe('This is clean text');
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
  it('redacts emails in ticket description', () => {
    const snapshot = {
      id: '123',
      title: 'Test Ticket',
      description: 'Contact user@example.com',
      status: 'OPEN',
      priority: 'MEDIUM',
      customerName: 'John Doe',
      productArea: 'API',
      messages: [],
    };

    const redacted = redactTicketSnapshot(snapshot);
    expect(redacted.description).toBe('Contact [EMAIL_REDACTED]');
  });

  it('redacts sensitive data in messages', () => {
    const snapshot = {
      id: '123',
      title: 'Test Ticket',
      description: 'Issue with API',
      status: 'OPEN',
      priority: 'MEDIUM',
      customerName: 'John Doe',
      productArea: 'API',
      messages: [
        {
          authorType: 'CUSTOMER',
          authorName: 'User',
          content: 'My email is test@example.com',
        },
        {
          authorType: 'AGENT',
          authorName: 'Support',
          content: 'I will contact you',
        },
      ],
    };

    const redacted = redactTicketSnapshot(snapshot);
    expect(redacted.messages[0].content).toBe('My email is [EMAIL_REDACTED]');
    expect(redacted.messages[1].content).toBe('I will contact you');
  });

  it('preserves non-sensitive fields', () => {
    const snapshot = {
      id: '123',
      title: 'Test Ticket',
      description: 'Clean description',
      status: 'OPEN',
      priority: 'MEDIUM',
      customerName: 'John Doe',
      productArea: 'API',
      messages: [],
    };

    const redacted = redactTicketSnapshot(snapshot);
    expect(redacted.id).toBe('123');
    expect(redacted.title).toBe('Test Ticket');
    expect(redacted.customerName).toBe('John Doe');
    expect(redacted.productArea).toBe('API');
  });
});
