import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

type Json = NonNullable<unknown>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok<T extends Json>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  error: string,
  status = 500,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error, ...(extra ?? {}) },
    { status },
  );
}

// Central error handler for route handlers. Logs and returns a safe response.
export function handleRouteError(
  err: unknown,
  route: string,
  context?: Record<string, unknown>,
) {
  if (err instanceof ZodError) {
    logger.warn('validation_error', {
      route,
      issues: err.issues,
      ...context,
    });
    return fail('Invalid request data', 400);
  }

  if (err instanceof ApiError) {
    logger.warn('api_error', {
      route,
      status: err.status,
      code: err.code,
      message: err.message,
      ...context,
    });
    return fail(err.message, err.status, { code: err.code });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error('route_error', {
    route,
    message,
    stack,
    ...context,
  });

  return fail(message, 500);
}
