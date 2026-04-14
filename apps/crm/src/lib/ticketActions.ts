'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { getDevContext } from './devDb';

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTicket(formData: FormData) {
  const { org, user } = await getDevContext();

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const customerName = (formData.get('customerName') as string)?.trim();
  const customerOrg = (formData.get('customerOrg') as string)?.trim();
  const productArea = (formData.get('productArea') as string)?.trim() || 'General';
  const priority = (formData.get('priority') as string) || 'MEDIUM';
  const channel = (formData.get('channel') as string) || null;

  if (!title || !description || !customerName) {
    throw new Error('Title, description, and customer name are required');
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        title,
        description,
        priority: priority as any,
        channel: channel as any,
        customerName,
        customerOrg: customerOrg || null,
        productArea,
        orgId: org.id,
        createdById: user.id,
      },
    });

    await tx.ticketMessage.create({
      data: {
        ticketId: t.id,
        authorType: 'CUSTOMER',
        authorName: customerName,
        content: description,
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: t.id,
        type: 'TICKET_CREATED',
        payload: { title, priority, customerName, productArea },
      },
    });

    return t;
  });

  redirect(`/tickets/${ticket.id}`);
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateTicketStatus(ticketId: string, status: string) {
  const old = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!old) return;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data: { status: status as any } });
    await tx.ticketEvent.create({
      data: {
        ticketId,
        type: 'STATUS_CHANGED',
        payload: { from: old.status, to: status },
      },
    });
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTicket(ticketId: string) {
  await prisma.ticket.delete({ where: { id: ticketId } });
  revalidatePath('/tickets');
  redirect('/tickets');
}

// ── Add message ───────────────────────────────────────────────────────────────

export async function addMessage(formData: FormData) {
  const ticketId = formData.get('ticketId') as string;
  const content = (formData.get('content') as string)?.trim();
  const authorType = (formData.get('authorType') as string) || 'AGENT';
  const authorName = (formData.get('authorName') as string)?.trim() || 'Agent';

  if (!content) return;

  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: { ticketId, authorType: authorType as any, authorName, content },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        type: 'MESSAGE_ADDED',
        payload: { authorType, authorName, contentPreview: content.slice(0, 100) },
      },
    });
  });

  revalidatePath(`/tickets/${ticketId}`);
}

// ── Generate dummy tickets ────────────────────────────────────────────────────

const DUMMY_TEMPLATES = [
  {
    title: 'Login page returns blank screen after password entry',
    description: 'After entering correct credentials and clicking Sign In, the page goes blank and nothing happens. No error message is displayed. Reproduced on Chrome and Edge.',
    customerName: 'Emma Richardson',
    customerOrg: 'BlueSky Partners',
    productArea: 'Authentication',
    priority: 'HIGH',
    channel: 'EMAIL',
    messages: [
      { authorType: 'CUSTOMER', content: 'After entering correct credentials and clicking Sign In, the page goes blank and nothing happens. No error message is displayed. Reproduced on Chrome and Edge.' },
      { authorType: 'AGENT', content: 'Hi Emma, thanks for reporting this. Can you open the browser console and share any errors you see? This sounds like it could be a JavaScript error blocking the redirect.' },
      { authorType: 'CUSTOMER', content: 'I see "Uncaught TypeError: Cannot read properties of undefined (reading \'token\')" in the console.' },
    ],
  },
  {
    title: 'Export to CSV truncates values longer than 255 characters',
    description: 'When exporting customer notes to CSV, any field with more than 255 characters is cut off. This causes data loss for longer notes.',
    customerName: 'Carlos Mendes',
    customerOrg: 'Meridian Analytics',
    productArea: 'Data Export',
    priority: 'MEDIUM',
    channel: 'WEB',
    messages: [
      { authorType: 'CUSTOMER', content: 'When exporting customer notes to CSV, any field with more than 255 characters is cut off. This causes data loss for longer notes.' },
      { authorType: 'AGENT', content: 'Confirmed. This is a known issue with our CSV serializer using a legacy VARCHAR(255) limit. We are tracking this as a bug.' },
    ],
  },
  {
    title: 'Email notifications sent in wrong timezone',
    description: 'Reminder emails show event times in UTC instead of the user\'s configured timezone. Users are missing meetings as a result.',
    customerName: 'Priya Nair',
    productArea: 'Notifications',
    priority: 'HIGH',
    channel: 'CHAT',
    messages: [
      { authorType: 'CUSTOMER', content: 'I keep getting reminders showing the wrong time. My timezone is set to IST (+5:30) but the emails show UTC. I missed a call because of this.' },
      { authorType: 'AGENT', content: 'Apologies for the confusion Priya. The notification system reads the timezone at email compile time, not user preference time. We are fixing this in the next patch.' },
    ],
  },
  {
    title: 'File upload silently fails for PDFs over 10 MB',
    description: 'Uploading a PDF attachment larger than 10 MB shows a success toast but the file never appears in the document library.',
    customerName: 'James Okafor',
    customerOrg: 'Thornfield Legal',
    productArea: 'File Management',
    priority: 'MEDIUM',
    channel: 'EMAIL',
    messages: [
      { authorType: 'CUSTOMER', content: 'I uploaded a 14 MB contract PDF and got the "Upload successful" message, but the file is nowhere to be found in the document library.' },
    ],
  },
  {
    title: 'Search autocomplete suggestions are stale after data update',
    description: 'After adding new customers, the search autocomplete still shows old results for up to 30 minutes due to aggressive caching.',
    customerName: 'Sophie Laurent',
    customerOrg: 'FrenchTech SA',
    productArea: 'Search',
    priority: 'LOW',
    channel: 'PHONE',
    messages: [
      { authorType: 'CUSTOMER', content: 'We added 50 new customer accounts this morning, but searching for them returns no results. Only after ~30 minutes do they show up in autocomplete.' },
      { authorType: 'AGENT', content: 'The autocomplete index is rebuilt every 30 minutes on a cron job. We will look into manual cache invalidation on record creation.' },
      { authorType: 'CUSTOMER', content: 'Appreciate the explanation! A manual refresh option in the admin panel would be helpful.' },
    ],
  },
  {
    title: 'Two-factor authentication backup codes not accepted',
    description: 'Users who lose their authenticator app and attempt to use backup codes receive "Invalid code" even when using unused codes from the original setup.',
    customerName: 'Marcus Webb',
    productArea: 'Authentication',
    priority: 'CRITICAL',
    channel: 'PHONE',
    messages: [
      { authorType: 'CUSTOMER', content: 'I changed phones and now my authenticator app has no accounts. I tried three different backup codes from my original setup email and all show "Invalid code".' },
      { authorType: 'AGENT', content: 'Marcus, I am escalating this immediately. Backup codes are being hashed incorrectly after our last deployment. I can manually disable 2FA on your account — can you verify your identity via email?' },
    ],
  },
  {
    title: 'Bulk user import fails with cryptic error on row 201',
    description: 'Importing more than 200 users via CSV consistently fails at row 201 with "Internal processing error". Imports of 200 or fewer rows work fine.',
    customerName: 'Fatima Al-Hassan',
    customerOrg: 'GulfStream Enterprises',
    productArea: 'User Management',
    priority: 'HIGH',
    channel: 'EMAIL',
    messages: [
      { authorType: 'CUSTOMER', content: 'We have 350 new employees to onboard. The CSV import fails every time at row 201 with an unhelpful error. Splitting into two batches works, but that is not scalable.' },
    ],
  },
  {
    title: 'Report builder chart colors do not match brand theme',
    description: 'Charts generated in the report builder use default blue/orange/green palette instead of the custom brand colors configured in Settings > Branding.',
    customerName: 'Lena Fischer',
    customerOrg: 'Dezign Studio GmbH',
    productArea: 'Reports',
    priority: 'LOW',
    channel: 'CHAT',
    messages: [
      { authorType: 'CUSTOMER', content: 'Our brand colors are configured in Branding settings but charts in the report builder still use the default palette. Screenshots attached.' },
      { authorType: 'AGENT', content: 'Thanks Lena. The report builder uses a separate charting library that does not yet read from brand settings. We have logged this as an improvement request.' },
      { authorType: 'CUSTOMER', content: 'Understood. Any ETA?' },
      { authorType: 'AGENT', content: 'It is on the Q3 roadmap. I will add you to the notification list for when it ships.' },
    ],
  },
  {
    title: 'API pagination returns duplicate records on page boundary',
    description: 'When paginating through /api/records with limit=50, records at the exact page boundary (record 50, 100, etc.) appear in both pages.',
    customerName: 'Hiroshi Tanaka',
    customerOrg: 'Tokai Systems',
    productArea: 'API',
    priority: 'MEDIUM',
    channel: 'EMAIL',
    messages: [
      { authorType: 'CUSTOMER', content: 'We are seeing duplicate records when processing paginated results. Record IDs on the boundary of each page appear twice. This causes double-processing issues in our data pipeline.' },
      { authorType: 'AGENT', content: 'Confirmed. The issue is in our cursor-based pagination logic — we are using >= instead of > for the boundary comparison. Fix going out in v2.14.1 tomorrow.' },
    ],
  },
  {
    title: 'Slack integration stops posting after workspace token refresh',
    description: 'Slack notifications stop working every 90 days when OAuth tokens rotate. The integration requires manual reconnection each time.',
    customerName: 'Olivia Patel',
    customerOrg: 'RocketTeam Inc',
    productArea: 'Integrations',
    priority: 'MEDIUM',
    channel: 'CHAT',
    messages: [
      { authorType: 'CUSTOMER', content: 'Our Slack notifications stopped working again. This is the third time in 9 months. It always happens after exactly 90 days and requires going through the full OAuth reconnection flow.' },
      { authorType: 'AGENT', content: 'Olivia, this is because Slack rotates OAuth tokens every 90 days and our integration does not implement the token refresh flow. This is a known gap. We are building automatic token refresh for Q2.' },
    ],
  },
];

export async function generateDummyTickets(count: number = 5) {
  const { org, user } = await getDevContext();

  const selected = [...DUMMY_TEMPLATES]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, DUMMY_TEMPLATES.length));

  await prisma.$transaction(async (tx) => {
    for (const tmpl of selected) {
      const statuses = ['OPEN', 'OPEN', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const ticket = await tx.ticket.create({
        data: {
          title: tmpl.title,
          description: tmpl.description,
          status,
          priority: tmpl.priority as any,
          channel: tmpl.channel as any,
          customerName: tmpl.customerName,
          customerOrg: tmpl.customerOrg ?? null,
          productArea: tmpl.productArea,
          orgId: org.id,
          createdById: user.id,
        },
      });

      for (const msg of tmpl.messages) {
        await tx.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: msg.authorType as any,
            authorName: msg.authorType === 'CUSTOMER' ? tmpl.customerName : 'Agent',
            content: msg.content,
          },
        });
      }

      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'TICKET_CREATED',
          payload: { title: ticket.title, priority: ticket.priority, customerName: ticket.customerName },
        },
      });
    }
  });

  revalidatePath('/tickets');
}
