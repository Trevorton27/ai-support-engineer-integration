// Lightweight structured JSON logger.
// Logs are emitted to stdout/stderr so any collector (Vercel, Datadog, etc)
// can parse them without additional transport.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
  child: (base: LogContext) => ({
    debug: (msg: string, ctx?: LogContext) =>
      emit('debug', msg, { ...base, ...ctx }),
    info: (msg: string, ctx?: LogContext) =>
      emit('info', msg, { ...base, ...ctx }),
    warn: (msg: string, ctx?: LogContext) =>
      emit('warn', msg, { ...base, ...ctx }),
    error: (msg: string, ctx?: LogContext) =>
      emit('error', msg, { ...base, ...ctx }),
  }),
};

export type Logger = typeof logger;
