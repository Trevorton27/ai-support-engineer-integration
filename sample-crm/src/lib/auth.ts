import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';

export async function authenticateRequest() {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, email: true, role: true, orgId: true },
  });

  if (!user) {
    return { error: 'User not found in CRM database', status: 404 };
  }

  return { user };
}
