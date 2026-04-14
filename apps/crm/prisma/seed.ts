import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.ticketEvent.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create org
  const org = await prisma.organization.create({
    data: { clerkOrgId: 'org_demo_001', name: 'Acme Corp' },
  });

  // Create users
  const admin = await prisma.user.create({
    data: {
      clerkUserId: 'user_demo_001',
      email: 'sarah@acme.com',
      role: 'ADMIN',
      orgId: org.id,
    },
  });

  const agent = await prisma.user.create({
    data: {
      clerkUserId: 'user_demo_002',
      email: 'mike@acme.com',
      role: 'AGENT',
      orgId: org.id,
    },
  });

  const ticketData = [
    {
      title: 'SSO login returns 500 for Chrome users',
      description:
        'Multiple customers on Chrome v120+ are getting 500 errors when attempting SSO login. Affects enterprise accounts using SAML integration.',
      status: 'OPEN' as const,
      priority: 'CRITICAL' as const,
      channel: 'EMAIL' as const,
      customerName: 'Jessica Palmer',
      customerOrg: 'TechFlow Inc',
      productArea: 'Authentication',
      createdById: admin.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Jessica Palmer',
          content:
            'Our entire team is unable to log in via SSO since this morning. We are using Chrome v120.0.6099.130 on Windows. The page returns a 500 Internal Server Error after clicking "Sign in with SSO". This is blocking our entire engineering department.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'sarah@acme.com',
          content:
            'Hi Jessica, thank you for reporting this. I can see elevated error rates on our SSO endpoint starting at 06:42 UTC today. I\'m escalating this to our authentication team immediately. Can you confirm which SAML provider you\'re using?',
        },
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Jessica Palmer',
          content:
            'We use Okta as our SAML provider. The configuration hasn\'t changed on our end. Firefox seems to work fine, only Chrome is affected.',
        },
        {
          authorType: 'SYSTEM' as const,
          authorName: 'System',
          content:
            'Ticket escalated to Authentication team. Priority: CRITICAL.',
        },
      ],
    },
    {
      title: 'Invoice PDF shows wrong tax rate',
      description:
        'Generated invoice PDFs show 15% tax rate instead of the correct 20% for UK customers.',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      channel: 'CHAT' as const,
      customerName: 'David Chen',
      customerOrg: 'GlobalPay Ltd',
      productArea: 'Billing',
      createdById: agent.id,
      assignedToId: agent.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'David Chen',
          content:
            'The invoice for our March billing cycle shows a 15% VAT rate. The correct UK VAT rate is 20%. This needs to be corrected before we can process the payment.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'mike@acme.com',
          content:
            'Thanks David, I\'ve confirmed the issue. It appears the tax rate table was updated incorrectly during our last deployment. I\'m working on a fix now and will regenerate the affected invoices.',
        },
        {
          authorType: 'SYSTEM' as const,
          authorName: 'System',
          content: 'Status changed from OPEN to IN_PROGRESS.',
        },
      ],
    },
    {
      title: 'Dashboard charts not loading on mobile',
      description:
        'Charts on the analytics dashboard fail to render on mobile devices. Shows blank white area.',
      status: 'OPEN' as const,
      priority: 'MEDIUM' as const,
      channel: 'WEB' as const,
      customerName: 'Anika Patel',
      productArea: 'Dashboard',
      createdById: admin.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Anika Patel',
          content:
            'When I open the analytics dashboard on my iPhone 15, all charts appear as blank white boxes. This works fine on desktop. I\'ve tried both Safari and Chrome on iOS 17.2.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'sarah@acme.com',
          content:
            'Thank you for the detailed report, Anika. This looks like it might be related to the chart rendering library not handling mobile viewport sizes correctly. Let me investigate.',
        },
      ],
    },
    {
      title: 'API rate limit too aggressive for batch imports',
      description:
        'The current 100 req/min rate limit is too restrictive for customers doing bulk data imports via the API.',
      status: 'OPEN' as const,
      priority: 'HIGH' as const,
      channel: 'EMAIL' as const,
      customerName: 'Tom Bradley',
      customerOrg: 'DataSync Corp',
      productArea: 'API',
      createdById: agent.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Tom Bradley',
          content:
            'We need to import 50,000 records via your API, but the 100 requests/minute rate limit means this would take over 8 hours. Can we get a temporary rate limit increase or a bulk import endpoint?',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'mike@acme.com',
          content:
            'Hi Tom, I understand the frustration. Let me check with our API team about temporary rate limit adjustments for bulk operations. In the meantime, have you considered using our batch endpoint at /api/v2/bulk-import?',
        },
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Tom Bradley',
          content:
            'I wasn\'t aware of the bulk endpoint! I\'ll try that. But it would still be helpful to have the rate limit documented more clearly.',
        },
      ],
    },
    {
      title: 'Password reset email not arriving',
      description:
        'Customers report that password reset emails are not being delivered. Checked spam folders.',
      status: 'RESOLVED' as const,
      priority: 'CRITICAL' as const,
      channel: 'PHONE' as const,
      customerName: 'Maria Gonzalez',
      productArea: 'Authentication',
      createdById: admin.id,
      assignedToId: admin.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Maria Gonzalez',
          content:
            'I\'ve tried resetting my password 5 times today and no email has arrived. I\'ve checked spam/junk folders. My email is maria@gonzalez-consulting.com.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'sarah@acme.com',
          content:
            'Maria, I can see the reset emails were sent but bounced. It appears your email provider is blocking our sending domain. I\'ve escalated to our email deliverability team.',
        },
        {
          authorType: 'SYSTEM' as const,
          authorName: 'System',
          content:
            'Root cause identified: SPF record for sending domain was misconfigured after DNS migration. Fix deployed.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'sarah@acme.com',
          content:
            'Good news — the SPF record has been corrected. Could you try the password reset again? It should work now.',
        },
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Maria Gonzalez',
          content: 'It works now! Thank you for the quick resolution.',
        },
      ],
    },
    {
      title: 'Feature request: dark mode for mobile app',
      description:
        'Users want a dark mode option in the mobile application for better nighttime usability.',
      status: 'CLOSED' as const,
      priority: 'LOW' as const,
      channel: 'WEB' as const,
      customerName: 'Ryan Kim',
      productArea: 'Mobile',
      createdById: agent.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Ryan Kim',
          content:
            'Would love to have a dark mode option in the mobile app. The bright white background is hard on the eyes when checking notifications at night.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'mike@acme.com',
          content:
            'Great suggestion, Ryan! I\'ve added this to our mobile app roadmap. Dark mode is planned for the Q3 release.',
        },
        {
          authorType: 'SYSTEM' as const,
          authorName: 'System',
          content:
            'Ticket closed. Added to roadmap: Mobile Dark Mode (Q3 2026).',
        },
      ],
    },
    {
      title: 'Webhook delivery retries not working',
      description:
        'Webhook deliveries that fail on first attempt are not being retried as documented.',
      status: 'IN_PROGRESS' as const,
      priority: 'MEDIUM' as const,
      channel: 'EMAIL' as const,
      customerName: 'Lisa Wang',
      customerOrg: 'IntegrationHub',
      productArea: 'API',
      createdById: admin.id,
      assignedToId: agent.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Lisa Wang',
          content:
            'According to your docs, failed webhook deliveries should be retried 3 times with exponential backoff. We\'re seeing that failed deliveries are never retried. Our endpoint was down for 2 minutes and we lost all events during that window.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'sarah@acme.com',
          content:
            'Lisa, thank you for catching this. I\'ve reviewed our webhook delivery logs and can confirm the retry logic has a bug — the retry queue consumer isn\'t picking up failed events. Our engineering team is working on a fix.',
        },
      ],
    },
    {
      title: 'Onboarding wizard skips step 3',
      description:
        'New user onboarding wizard jumps from step 2 directly to step 4, skipping the team setup step.',
      status: 'OPEN' as const,
      priority: 'MEDIUM' as const,
      channel: 'CHAT' as const,
      customerName: 'Alex Johnson',
      customerOrg: 'StartupLabs',
      productArea: 'Dashboard',
      createdById: agent.id,
      messages: [
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Alex Johnson',
          content:
            'Just signed up for a team account. The onboarding wizard went from "Personal Profile" (step 2) directly to "First Project" (step 4). I never got the option to invite team members in step 3.',
        },
        {
          authorType: 'AGENT' as const,
          authorName: 'mike@acme.com',
          content:
            'Hi Alex, sorry about that. It seems the team setup step might be conditionally hidden. Can you tell me what plan you signed up for? The team invite step should appear for all Team and Enterprise plans.',
        },
        {
          authorType: 'CUSTOMER' as const,
          authorName: 'Alex Johnson',
          content:
            'I\'m on the Team plan. It says "Team Plan" in my account settings.',
        },
      ],
    },
  ];

  for (const data of ticketData) {
    const { messages, ...ticketFields } = data;

    const ticket = await prisma.ticket.create({
      data: { ...ticketFields, orgId: org.id },
    });

    for (const msg of messages) {
      await prisma.ticketMessage.create({
        data: { ...msg, ticketId: ticket.id },
      });
    }

    // Create TICKET_CREATED event
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'TICKET_CREATED',
        payload: {
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          customerName: ticket.customerName,
          productArea: ticket.productArea,
        },
      },
    });

    // Create STATUS_CHANGED event for non-OPEN tickets
    if (ticket.status !== 'OPEN') {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'STATUS_CHANGED',
          payload: { from: 'OPEN', to: ticket.status },
        },
      });
    }

    // Create MESSAGE_ADDED events
    for (const msg of messages.slice(1)) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'MESSAGE_ADDED',
          payload: {
            authorType: msg.authorType,
            authorName: msg.authorName,
            contentPreview: msg.content.slice(0, 100),
          },
        },
      });
    }
  }

  // Add sample attachments to first two tickets
  const tickets = await prisma.ticket.findMany({
    take: 2,
    orderBy: { createdAt: 'asc' },
    include: { messages: { take: 1, orderBy: { createdAt: 'asc' } } },
  });

  if (tickets[0]) {
    await prisma.attachment.create({
      data: {
        ticketId: tickets[0].id,
        messageId: tickets[0].messages[0]?.id,
        fileName: 'chrome-error-log.txt',
        fileUrl: '/uploads/sample-chrome-error-log.txt',
        fileType: 'text/plain',
        size: 2048,
        checksum: 'a1b2c3d4e5f6',
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId: tickets[0].id,
        type: 'ATTACHMENT_ADDED',
        payload: {
          fileName: 'chrome-error-log.txt',
          fileType: 'text/plain',
          size: 2048,
        },
      },
    });
  }

  if (tickets[1]) {
    await prisma.attachment.create({
      data: {
        ticketId: tickets[1].id,
        messageId: tickets[1].messages[0]?.id,
        fileName: 'invoice-screenshot.png',
        fileUrl: '/uploads/sample-invoice-screenshot.png',
        fileType: 'image/png',
        size: 154000,
        checksum: 'f6e5d4c3b2a1',
      },
    });
  }

  const totalTickets = await prisma.ticket.count();
  const totalMessages = await prisma.ticketMessage.count();
  const totalEvents = await prisma.ticketEvent.count();
  const totalAttachments = await prisma.attachment.count();

  console.log(
    `Seed complete: ${totalTickets} tickets, ${totalMessages} messages, ${totalEvents} events, ${totalAttachments} attachments`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
