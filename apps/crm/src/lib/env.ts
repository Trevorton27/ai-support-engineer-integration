import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
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
      `\n[env] Invalid environment configuration for crm:\n${issues}\n`,
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

if (process.env.NODE_ENV !== 'test' && process.env.SKIP_ENV_VALIDATION !== '1') {
  getEnv();
}
