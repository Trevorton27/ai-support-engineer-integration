import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './prisma';

// The stable dev org created by the no-auth CRM UI
const DEV_ORG_CLERK_ID = 'org_dev_local';

export async function authenticateRequest() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }

  // Prefer the dev org so tickets from the CRM UI are always visible
  const devOrg = await prisma.organization.findUnique({
    where: { clerkOrgId: DEV_ORG_CLERK_ID },
  });

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, email: true, role: true, orgId: true },
  });

  if (user) {
    // If the dev org exists and the user isn't in it yet, migrate them
    if (devOrg && user.orgId !== devOrg.id) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { orgId: devOrg.id },
        select: { id: true, email: true, role: true, orgId: true },
      });
    }
    return { user };
  }

  // Auto-provision new user
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@unknown.local`;

  const org = devOrg ?? await prisma.organization.upsert({
    where: { clerkOrgId: orgId ?? `personal_${userId}` },
    update: {},
    create: {
      clerkOrgId: orgId ?? `personal_${userId}`,
      name: 'My Organization',
    },
  });

  user = await prisma.user.create({
    data: {
      clerkUserId: userId,
      email,
      role: 'ADMIN',
      orgId: org.id,
    },
    select: { id: true, email: true, role: true, orgId: true },
  });

  return { user };
}
