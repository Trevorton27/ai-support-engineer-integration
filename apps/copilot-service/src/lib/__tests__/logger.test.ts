import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('emits JSON to stdout for info', () => {
    logger.info('hello', { x: 1 });
    const line = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello');
    expect(parsed.x).toBe(1);
    expect(parsed.time).toBeTruthy();
  });

  it('emits JSON to stderr for errors', () => {
    logger.error('boom');
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('child logger merges base context', () => {
    const child = logger.child({ requestId: 'req-1' });
    child.info('ping');
    const line = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.requestId).toBe('req-1');
  });
});
