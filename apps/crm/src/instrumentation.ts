export async function register() {
  // Validate environment on server startup (not during build).
  await import('./lib/env');
}
