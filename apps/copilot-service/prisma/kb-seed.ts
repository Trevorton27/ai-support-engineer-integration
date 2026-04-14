import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const articles = [
  {
    title: 'How to Reset Your Password',
    content:
      'If you have forgotten your password, navigate to the login page and click "Forgot Password". Enter your email address and we will send you a password reset link. The link expires after 24 hours. If you do not receive the email, check your spam folder or contact support. For security, you cannot reuse any of your last 5 passwords. Passwords must be at least 8 characters with one uppercase letter, one number, and one special character.',
    url: 'https://help.example.com/password-reset',
    productArea: 'General',
  },
  {
    title: 'Billing FAQ: Invoices, Refunds, and Payment Methods',
    content:
      'Invoices are generated on the 1st of each month and emailed to the billing contact. To update your payment method, go to Settings > Billing > Payment Methods. Refund requests must be submitted within 30 days of the charge. Prorated refunds are issued when downgrading mid-cycle. If your payment fails, we retry 3 times over 7 days before suspending the account. To reactivate a suspended account, update your payment method and contact billing support.',
    url: 'https://help.example.com/billing-faq',
    productArea: 'Billing',
  },
  {
    title: 'Troubleshooting API Rate Limit Errors (429)',
    content:
      'If you receive a 429 Too Many Requests error, your application has exceeded the API rate limit. The default rate limit is 100 requests per minute per API key. Implement exponential backoff: wait 1s, then 2s, then 4s between retries. Check the X-RateLimit-Remaining and X-RateLimit-Reset response headers to track your quota. For higher limits, upgrade to a Pro or Enterprise plan. Batch operations can reduce request count — use the /batch endpoint for bulk data operations.',
    url: 'https://help.example.com/api-rate-limits',
    productArea: 'API',
  },
  {
    title: 'Mobile App Crash on Launch (iOS and Android)',
    content:
      'If the mobile app crashes immediately on launch, try these steps: 1) Force quit the app and reopen. 2) Clear the app cache (Settings > Apps > [App Name] > Clear Cache). 3) Ensure you are on the latest app version from the App Store or Google Play. 4) Restart your device. 5) Uninstall and reinstall the app. Known issue: app version 3.2.0 crashes on iOS 16.x due to a WebKit compatibility bug — update to 3.2.1 or later. If the issue persists, collect a crash log and send it to support.',
    url: 'https://help.example.com/mobile-crash',
    productArea: 'Mobile',
  },
  {
    title: 'Slow Dashboard Loading and Performance Issues',
    content:
      'If the dashboard takes more than 5 seconds to load, check the following: 1) Network connection — run a speed test. 2) Browser — we recommend Chrome or Firefox; Safari may have rendering delays on data-heavy pages. 3) Clear browser cache and cookies. 4) Disable browser extensions that may interfere (ad blockers, privacy extensions). 5) Check our status page for any ongoing performance incidents. For organizations with 10,000+ records, enable pagination in Settings > Display > Table Pagination. The dashboard uses lazy loading — the initial load fetches summary data, and details load on demand.',
    url: 'https://help.example.com/slow-dashboard',
    productArea: 'General',
  },
  {
    title: 'Setting Up Single Sign-On (SSO) with SAML',
    content:
      'To configure SSO with SAML: 1) Go to Settings > Security > SSO. 2) Select SAML 2.0 as the protocol. 3) Enter your Identity Provider (IdP) metadata URL or upload the metadata XML. 4) Map the required attributes: email (required), firstName, lastName, role. 5) Test the connection using the "Test SSO" button. 6) Enable SSO for your organization. Once enabled, users will be redirected to your IdP for authentication. You can enforce SSO-only login to disable password-based access. Supported IdPs: Okta, Azure AD, OneLogin, Google Workspace.',
    url: 'https://help.example.com/sso-setup',
    productArea: 'General',
  },
  {
    title: 'Webhook Integration: Setup and Troubleshooting',
    content:
      'To set up webhooks: 1) Go to Settings > Integrations > Webhooks. 2) Enter your endpoint URL (must be HTTPS). 3) Select the events you want to receive (e.g., ticket.created, ticket.updated). 4) Save and test with the "Send Test Event" button. Webhook payloads are JSON and include a signature header (X-Webhook-Signature) for verification using HMAC-SHA256. If deliveries fail, we retry with exponential backoff (1min, 5min, 30min, 2hr) up to 5 times. Check the webhook delivery log in Settings for failed attempts and error codes.',
    url: 'https://help.example.com/webhooks',
    productArea: 'API',
  },
  {
    title: 'Data Export and GDPR Compliance',
    content:
      'To export your data: go to Settings > Data > Export. You can export tickets, contacts, and conversations as CSV or JSON. Exports are queued and a download link is emailed when ready (usually within 15 minutes for up to 100K records). For GDPR data subject requests: use the "Right to Erasure" tool in Settings > Privacy to anonymize a specific customer record. This redacts PII from all tickets and messages associated with that customer while preserving aggregate metrics. An audit log entry is created for compliance records.',
    url: 'https://help.example.com/data-export-gdpr',
    productArea: 'General',
  },
];

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

async function seed() {
  console.log(`Seeding ${articles.length} KB articles...`);

  for (const article of articles) {
    const embedding = await generateEmbedding(`${article.title}\n${article.content}`);
    const vectorStr = `[${embedding.join(',')}]`;
    const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeBaseArticle" (id, title, content, url, "productArea", embedding, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      id,
      article.title,
      article.content,
      article.url,
      article.productArea,
      vectorStr,
      now,
      now,
    );

    console.log(`  ✓ ${article.title}`);
  }

  console.log('Done!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
