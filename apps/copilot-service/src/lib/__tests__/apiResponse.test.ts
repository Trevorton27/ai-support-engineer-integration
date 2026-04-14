import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ok, fail, handleRouteError, ApiError } from '../apiResponse';

describe('apiResponse', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('ok() wraps data with ok:true', async () => {
    const res = ok({ foo: 'bar' });
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { foo: 'bar' } });
    expect(res.status).toBe(200);
  });

  it('fail() wraps error with ok:false', async () => {
    const res = fail('nope', 400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('nope');
    expect(res.status).toBe(400);
  });

  it('handleRouteError maps ZodError to 400', async () => {
    const schema = z.object({ id: z.string() });
    let res: Response;
    try {
      schema.parse({});
      throw new Error('unreachable');
    } catch (err) {
      res = handleRouteError(err, 'test');
    }
    const body = await res!.json();
    expect(res!.status).toBe(400);
    expect(body.error).toBe('Invalid request data');
  });

  it('handleRouteError maps ApiError to its status', async () => {
    const err = new ApiError(429, 'rate_limit_exceeded', 'Too many');
    const res = handleRouteError(err, 'test');
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe('rate_limit_exceeded');
    expect(body.error).toBe('Too many');
  });

  it('handleRouteError falls back to 500 for unknown errors', async () => {
    const res = handleRouteError(new Error('boom'), 'test');
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('boom');
  });
});
