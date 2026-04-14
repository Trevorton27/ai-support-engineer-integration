import { prisma } from './prisma';

const DEV_ORG_CLERK_ID = 'org_dev_local';
const DEV_USER_CLERK_ID = 'user_dev_local';

/**
 * Returns a stable dev org + user, creating them if they don't exist.
 * Used by the no-auth UI so every mutation has a valid orgId/createdById.
 */
export async function getDevContext() {
  const org = await prisma.organization.upsert({
    where: { clerkOrgId: DEV_ORG_CLERK_ID },
    update: {},
    create: { clerkOrgId: DEV_ORG_CLERK_ID, name: 'Dev Organization' },
  });

  const user = await prisma.user.upsert({
    where: { clerkUserId: DEV_USER_CLERK_ID },
    update: {},
    create: {
      clerkUserId: DEV_USER_CLERK_ID,
      email: 'dev@localhost',
      role: 'ADMIN',
      orgId: org.id,
    },
  });

  return { org, user };
}
