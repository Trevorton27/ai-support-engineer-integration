import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  CRM_API_BASE_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(
      `\n[env] Invalid environment configuration for copilot-service:\n${issues}\n`,
    );
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) _env = parseEnv();
  return _env;
}

// Eagerly validate at import time outside of test runs so misconfiguration
// surfaces on boot rather than on first request.
if (process.env.NODE_ENV !== 'test' && process.env.SKIP_ENV_VALIDATION !== '1') {
  getEnv();
}
