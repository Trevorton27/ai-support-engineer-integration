import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic IDs so tests, screenshots, and demos can reference fixed URLs
// (e.g. /tickets/tkt_001). Keep these stable across seed runs.
const ORG_ID = 'org_demo_acme';
const USER_ADMIN = 'usr_admin_sarah';
const USER_AGENT = 'usr_agent_mike';

type SeedMessage = {
  authorType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  authorName: string;
  content: string;
};

type SeedTicket = {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  channel: 'EMAIL' | 'CHAT' | 'WEB' | 'PHONE';
  customerName: string;
  customerOrg?: string;
  productArea: string;
  createdById: string;
  assignedToId?: string;
  messages: SeedMessage[];
};

const tickets: SeedTicket[] = [
  {
    id: 'tkt_001',
    title: 'SSO login returns 500 for Chrome users',
    description:
      'Multiple customers on Chrome v120+ are getting 500 errors when attempting SSO login. Affects enterprise accounts using SAML integration.',
    status: 'OPEN',
    priority: 'CRITICAL',
    channel: 'EMAIL',
    customerName: 'Jessica Palmer',
    customerOrg: 'TechFlow Inc',
    productArea: 'Authentication',
    createdById: USER_ADMIN,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Jessica Palmer',
        content:
          'Our entire team is unable to log in via SSO since this morning. We are using Chrome v120.0.6099.130 on Windows. The page returns a 500 Internal Server Error after clicking "Sign in with SSO". This is blocking our entire engineering department.',
      },
      {
        authorType: 'AGENT',
        authorName: 'sarah@acme.com',
        content:
          "Hi Jessica, thank you for reporting this. I can see elevated error rates on our SSO endpoint starting at 06:42 UTC today. I'm escalating this to our authentication team immediately. Can you confirm which SAML provider you're using?",
      },
      {
        authorType: 'CUSTOMER',
        authorName: 'Jessica Palmer',
        content:
          "We use Okta as our SAML provider. The configuration hasn't changed on our end. Firefox seems to work fine, only Chrome is affected.",
      },
      {
        authorType: 'SYSTEM',
        authorName: 'System',
        content: 'Ticket escalated to Authentication team. Priority: CRITICAL.',
      },
    ],
  },
  {
    id: 'tkt_002',
    title: 'Invoice PDF shows wrong tax rate',
    description:
      'Generated invoice PDFs show 15% tax rate instead of the correct 20% for UK customers.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    channel: 'CHAT',
    customerName: 'David Chen',
    customerOrg: 'GlobalPay Ltd',
    productArea: 'Billing',
    createdById: USER_AGENT,
    assignedToId: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'David Chen',
        content:
          'The invoice for our March billing cycle shows a 15% VAT rate. The correct UK VAT rate is 20%. This needs to be corrected before we can process the payment.',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          "Thanks David, I've confirmed the issue. It appears the tax rate table was updated incorrectly during our last deployment. I'm working on a fix now and will regenerate the affected invoices.",
      },
      {
        authorType: 'SYSTEM',
        authorName: 'System',
        content: 'Status changed from OPEN to IN_PROGRESS.',
      },
    ],
  },
  {
    id: 'tkt_003',
    title: 'Dashboard charts not loading on mobile',
    description:
      'Charts on the analytics dashboard fail to render on mobile devices. Shows blank white area.',
    status: 'OPEN',
    priority: 'MEDIUM',
    channel: 'WEB',
    customerName: 'Anika Patel',
    productArea: 'Dashboard',
    createdById: USER_ADMIN,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Anika Patel',
        content:
          "When I open the analytics dashboard on my iPhone 15, all charts appear as blank white boxes. This works fine on desktop. I've tried both Safari and Chrome on iOS 17.2.",
      },
      {
        authorType: 'AGENT',
        authorName: 'sarah@acme.com',
        content:
          'Thank you for the detailed report, Anika. This looks like it might be related to the chart rendering library not handling mobile viewport sizes correctly. Let me investigate.',
      },
    ],
  },
  {
    id: 'tkt_004',
    title: 'API rate limit too aggressive for batch imports',
    description:
      'The current 100 req/min rate limit is too restrictive for customers doing bulk data imports via the API.',
    status: 'OPEN',
    priority: 'HIGH',
    channel: 'EMAIL',
    customerName: 'Tom Bradley',
    customerOrg: 'DataSync Corp',
    productArea: 'API',
    createdById: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Tom Bradley',
        content:
          'We need to import 50,000 records via your API, but the 100 requests/minute rate limit means this would take over 8 hours. Can we get a temporary rate limit increase or a bulk import endpoint?',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          'Hi Tom, I understand the frustration. Let me check with our API team about temporary rate limit adjustments for bulk operations. In the meantime, have you considered using our batch endpoint at /api/v2/bulk-import?',
      },
      {
        authorType: 'CUSTOMER',
        authorName: 'Tom Bradley',
        content:
          "I wasn't aware of the bulk endpoint! I'll try that. But it would still be helpful to have the rate limit documented more clearly.",
      },
    ],
  },
  {
    id: 'tkt_005',
    title: 'Password reset email not arriving',
    description:
      'Customers report that password reset emails are not being delivered. Checked spam folders.',
    status: 'RESOLVED',
    priority: 'CRITICAL',
    channel: 'PHONE',
    customerName: 'Maria Gonzalez',
    productArea: 'Authentication',
    createdById: USER_ADMIN,
    assignedToId: USER_ADMIN,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Maria Gonzalez',
        content:
          "I've tried resetting my password 5 times today and no email has arrived. I've checked spam/junk folders. My email is maria@gonzalez-consulting.com.",
      },
      {
        authorType: 'AGENT',
        authorName: 'sarah@acme.com',
        content:
          "Maria, I can see the reset emails were sent but bounced. It appears your email provider is blocking our sending domain. I've escalated to our email deliverability team.",
      },
      {
        authorType: 'SYSTEM',
        authorName: 'System',
        content:
          'Root cause identified: SPF record for sending domain was misconfigured after DNS migration. Fix deployed.',
      },
      {
        authorType: 'AGENT',
        authorName: 'sarah@acme.com',
        content:
          'Good news — the SPF record has been corrected. Could you try the password reset again? It should work now.',
      },
      {
        authorType: 'CUSTOMER',
        authorName: 'Maria Gonzalez',
        content: 'It works now! Thank you for the quick resolution.',
      },
    ],
  },
  {
    id: 'tkt_006',
    title: 'Feature request: dark mode for mobile app',
    description:
      'Users want a dark mode option in the mobile application for better nighttime usability.',
    status: 'CLOSED',
    priority: 'LOW',
    channel: 'WEB',
    customerName: 'Ryan Kim',
    productArea: 'Mobile',
    createdById: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Ryan Kim',
        content:
          'Would love to have a dark mode option in the mobile app. The bright white background is hard on the eyes when checking notifications at night.',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          "Great suggestion, Ryan! I've added this to our mobile app roadmap. Dark mode is planned for the Q3 release.",
      },
      {
        authorType: 'SYSTEM',
        authorName: 'System',
        content:
          'Ticket closed. Added to roadmap: Mobile Dark Mode (Q3 2026).',
      },
    ],
  },
  {
    id: 'tkt_007',
    title: 'Webhook delivery retries not working',
    description:
      'Webhook deliveries that fail on first attempt are not being retried as documented.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    channel: 'EMAIL',
    customerName: 'Lisa Wang',
    customerOrg: 'IntegrationHub',
    productArea: 'API',
    createdById: USER_ADMIN,
    assignedToId: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Lisa Wang',
        content:
          "According to your docs, failed webhook deliveries should be retried 3 times with exponential backoff. We're seeing that failed deliveries are never retried. Our endpoint was down for 2 minutes and we lost all events during that window.",
      },
      {
        authorType: 'AGENT',
        authorName: 'sarah@acme.com',
        content:
          "Lisa, thank you for catching this. I've reviewed our webhook delivery logs and can confirm the retry logic has a bug — the retry queue consumer isn't picking up failed events. Our engineering team is working on a fix.",
      },
    ],
  },
  {
    id: 'tkt_008',
    title: 'Onboarding wizard skips step 3',
    description:
      'New user onboarding wizard jumps from step 2 directly to step 4, skipping the team setup step.',
    status: 'OPEN',
    priority: 'MEDIUM',
    channel: 'CHAT',
    customerName: 'Alex Johnson',
    customerOrg: 'StartupLabs',
    productArea: 'Dashboard',
    createdById: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Alex Johnson',
        content:
          'Just signed up for a team account. The onboarding wizard went from "Personal Profile" (step 2) directly to "First Project" (step 4). I never got the option to invite team members in step 3.',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          'Hi Alex, sorry about that. It seems the team setup step might be conditionally hidden. Can you tell me what plan you signed up for? The team invite step should appear for all Team and Enterprise plans.',
      },
      {
        authorType: 'CUSTOMER',
        authorName: 'Alex Johnson',
        content:
          'I\'m on the Team plan. It says "Team Plan" in my account settings.',
      },
    ],
  },
  // ---- Additional scenarios added for richer RAG / Similar Cases demos ----
  {
    id: 'tkt_009',
    title: 'Dashboard takes 15+ seconds to load for large org',
    description:
      'Enterprise customer with ~40k tickets experiences very slow dashboard load times.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    channel: 'EMAIL',
    customerName: 'Priya Natarajan',
    customerOrg: 'OmegaScale',
    productArea: 'Dashboard',
    createdById: USER_ADMIN,
    assignedToId: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Priya Natarajan',
        content:
          'Our agents are reporting dashboard load times of 15-20 seconds. We have around 40,000 tickets. This is impacting productivity significantly. Chrome on macOS.',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          "Thanks Priya. For orgs with 10k+ records we recommend enabling Table Pagination under Settings > Display. I'll also check our backend metrics to see if the summary queries can be optimized for your tenant.",
      },
    ],
  },
  {
    id: 'tkt_010',
    title: 'Request: GDPR data export for former customer',
    description:
      'Legal received a right-to-erasure request. Need to export and then anonymize all data for one customer.',
    status: 'OPEN',
    priority: 'HIGH',
    channel: 'EMAIL',
    customerName: 'Karen Ellis (Legal Ops)',
    customerOrg: 'Nimbus Retail',
    productArea: 'General',
    createdById: USER_ADMIN,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Karen Ellis',
        content:
          'We received a GDPR Article 17 request from a former customer. Can you walk me through exporting their data and then anonymizing the records? We need this completed within the 30-day statutory window.',
      },
    ],
  },
  {
    id: 'tkt_011',
    title: 'Mobile app 3.2.0 crashes on iPhone immediately after login',
    description:
      'Several iOS users are reporting immediate crash after successful login. Android works fine.',
    status: 'RESOLVED',
    priority: 'CRITICAL',
    channel: 'PHONE',
    customerName: 'Jamal Robinson',
    productArea: 'Mobile',
    createdById: USER_AGENT,
    assignedToId: USER_AGENT,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Jamal Robinson',
        content:
          'App version 3.2.0 on iOS 16.5 — login succeeds, then the app crashes. Works on iOS 17. My team has about 50 users blocked.',
      },
      {
        authorType: 'AGENT',
        authorName: 'mike@acme.com',
        content:
          'This matches a known WebKit compatibility issue with 3.2.0 on iOS 16.x. Please update to 3.2.1 from the App Store; that patch ships the workaround.',
      },
      {
        authorType: 'CUSTOMER',
        authorName: 'Jamal Robinson',
        content: 'Updated and it works. Thanks for the quick turnaround.',
      },
    ],
  },
  {
    id: 'tkt_012',
    title: 'How do I enforce SSO-only login across my org?',
    description:
      'Security team wants to disable password login entirely once SAML SSO is set up.',
    status: 'OPEN',
    priority: 'MEDIUM',
    channel: 'CHAT',
    customerName: 'Devon Hale',
    customerOrg: 'BrightForge',
    productArea: 'Authentication',
    createdById: USER_ADMIN,
    messages: [
      {
        authorType: 'CUSTOMER',
        authorName: 'Devon Hale',
        content:
          "We've configured SAML with Azure AD and it's working. Now we want to require SSO for everyone — no password fallback. How do we toggle that?",
      },
    ],
  },
];

async function main() {
  // Clean existing data in dependency order
  await prisma.ticketEvent.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Org + users with deterministic IDs
  await prisma.organization.create({
    data: { id: ORG_ID, clerkOrgId: 'org_demo_001', name: 'Acme Corp' },
  });

  await prisma.user.create({
    data: {
      id: USER_ADMIN,
      clerkUserId: 'user_demo_001',
      email: 'sarah@acme.com',
      role: 'ADMIN',
      orgId: ORG_ID,
    },
  });

  await prisma.user.create({
    data: {
      id: USER_AGENT,
      clerkUserId: 'user_demo_002',
      email: 'mike@acme.com',
      role: 'AGENT',
      orgId: ORG_ID,
    },
  });

  for (const data of tickets) {
    const { messages, ...ticketFields } = data;

    await prisma.ticket.create({
      data: { ...ticketFields, orgId: ORG_ID },
    });

    let msgIndex = 0;
    for (const msg of messages) {
      await prisma.ticketMessage.create({
        data: {
          id: `${data.id}_msg_${String(msgIndex).padStart(2, '0')}`,
          ...msg,
          ticketId: data.id,
        },
      });
      msgIndex += 1;
    }

    // TICKET_CREATED event
    await prisma.ticketEvent.create({
      data: {
        ticketId: data.id,
        type: 'TICKET_CREATED',
        payload: {
          title: data.title,
          priority: data.priority,
          status: data.status,
          customerName: data.customerName,
          productArea: data.productArea,
        },
      },
    });

    // STATUS_CHANGED event for non-OPEN tickets
    if (data.status !== 'OPEN') {
      await prisma.ticketEvent.create({
        data: {
          ticketId: data.id,
          type: 'STATUS_CHANGED',
          payload: { from: 'OPEN', to: data.status },
        },
      });
    }

    // MESSAGE_ADDED events (skip first message to avoid redundancy with creation)
    for (const msg of messages.slice(1)) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: data.id,
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

  // Attachments on the two critical tickets (deterministic)
  await prisma.attachment.create({
    data: {
      id: 'att_tkt_001',
      ticketId: 'tkt_001',
      messageId: 'tkt_001_msg_00',
      fileName: 'chrome-error-log.txt',
      fileUrl: '/uploads/sample-chrome-error-log.txt',
      fileType: 'text/plain',
      size: 2048,
      checksum: 'a1b2c3d4e5f6',
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticketId: 'tkt_001',
      type: 'ATTACHMENT_ADDED',
      payload: {
        fileName: 'chrome-error-log.txt',
        fileType: 'text/plain',
        size: 2048,
      },
    },
  });

  await prisma.attachment.create({
    data: {
      id: 'att_tkt_002',
      ticketId: 'tkt_002',
      messageId: 'tkt_002_msg_00',
      fileName: 'invoice-screenshot.png',
      fileUrl: '/uploads/sample-invoice-screenshot.png',
      fileType: 'image/png',
      size: 154000,
      checksum: 'f6e5d4c3b2a1',
    },
  });

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
