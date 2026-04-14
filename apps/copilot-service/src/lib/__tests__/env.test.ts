import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('env validation', () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...original, NODE_ENV: 'test', SKIP_ENV_VALIDATION: '1' };
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('parses when required vars are present', async () => {
    process.env.DATABASE_URL = 'postgres://x';
    process.env.OPENAI_API_KEY = 'sk-test';
    const { getEnv } = await import('../env');
    const env = getEnv();
    expect(env.DATABASE_URL).toBe('postgres://x');
    expect(env.OPENAI_API_KEY).toBe('sk-test');
  });

  it('throws when required vars are missing', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    const { getEnv } = await import('../env');
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });

  it('throws when CRM_API_BASE_URL is not a valid URL', async () => {
    process.env.DATABASE_URL = 'postgres://x';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.CRM_API_BASE_URL = 'not-a-url';
    const { getEnv } = await import('../env');
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });
});
