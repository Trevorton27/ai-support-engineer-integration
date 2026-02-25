import OpenAI from 'openai';
import type { TicketSnapshot } from './crmClient';
import { redactTicketSnapshot } from './redaction';
import {
  AnalysisResultSchema,
  NextStepsResultSchema,
  DraftReplyResultSchema,
  ChatResultSchema,
  type AnalysisResult,
  type NextStepsResult,
  type DraftReplyResult,
  type ChatResult,
} from './schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeTicket(
  ticket: TicketSnapshot,
): Promise<AnalysisResult> {
  // Redact sensitive data before sending to LLM
  const redacted = redactTicketSnapshot(ticket);

  const prompt = `Analyze this support ticket and provide:
1. A concise summary
2. Sentiment (positive/neutral/negative)
3. Category (technical/billing/feature-request/bug/other)
4. Urgency level (low/medium/high/critical)
5. Suggested actions (3-5 items)

Ticket:
Title: ${redacted.title}
Description: ${redacted.description}
Customer: ${redacted.customerName}
Product Area: ${redacted.productArea}

Messages:
${redacted.messages.map((m) => `${m.authorName} (${m.authorType}): ${m.content}`).join('\n')}

Respond in JSON format matching this schema:
{
  "summary": "...",
  "sentiment": "positive|neutral|negative",
  "category": "technical|billing|feature-request|bug|other",
  "urgency": "low|medium|high|critical",
  "suggestedActions": ["action1", "action2", ...]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a support ticket analysis assistant. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const rawResult = JSON.parse(completion.choices[0].message.content || '{}');

  // Validate with Zod
  const validatedResult = AnalysisResultSchema.parse(rawResult);

  return validatedResult;
}

export async function suggestNextSteps(
  ticket: TicketSnapshot,
): Promise<NextStepsResult> {
  // Redact sensitive data
  const redacted = redactTicketSnapshot(ticket);

  const prompt = `Based on this support ticket, suggest 3-5 actionable next steps for the support agent.

Ticket: ${redacted.title}
Status: ${redacted.status}
Priority: ${redacted.priority}

Return JSON: { "steps": ["step1", "step2", ...] }`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a support workflow assistant. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const rawResult = JSON.parse(completion.choices[0].message.content || '{}');

  // Validate with Zod
  const validatedResult = NextStepsResultSchema.parse(rawResult);

  return validatedResult;
}

export async function draftReply(
  ticket: TicketSnapshot,
  tone: 'professional' | 'friendly' | 'concise',
): Promise<DraftReplyResult> {
  // Redact sensitive data
  const redacted = redactTicketSnapshot(ticket);

  const toneInstructions = {
    professional: 'formal and respectful',
    friendly: 'warm and conversational',
    concise: 'brief and to-the-point',
  };

  const latestMessage =
    redacted.messages[redacted.messages.length - 1]?.content ||
    redacted.description;

  const prompt = `Draft a ${toneInstructions[tone]} reply to this customer.

Ticket: ${redacted.title}
Latest message: ${latestMessage}

Return JSON: { "reply": "..." }`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a customer support agent. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const rawResult = JSON.parse(completion.choices[0].message.content || '{}');

  // Validate with Zod
  const validatedResult = DraftReplyResultSchema.parse(rawResult);

  return validatedResult;
}

export async function chatAboutTicket(
  ticket: TicketSnapshot,
  question: string,
): Promise<ChatResult> {
  // Redact sensitive data
  const redacted = redactTicketSnapshot(ticket);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are helping analyze this ticket: ${redacted.title}. Always respond with valid JSON in format: { "answer": "..." }`,
      },
      { role: 'user', content: question },
    ],
    response_format: { type: 'json_object' },
  });

  const rawResult = JSON.parse(completion.choices[0].message.content || '{}');

  // Validate with Zod
  const validatedResult = ChatResultSchema.parse(rawResult);

  return validatedResult;
}
