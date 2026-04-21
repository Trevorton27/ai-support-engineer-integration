export async function register() {
  // Validate environment on server startup (not during build).
  await import('./lib/env');

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('./lib/prisma');
    const count = await prisma.ticket.count();
    if (count === 0) {
      const { execSync } = await import('child_process');
      console.log('[startup] No tickets found — running seed...');
      execSync('npx prisma db seed', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
    }
  }
}
