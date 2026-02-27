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

  const prompt = `You are a senior support engineer. Analyze the following support ticket and return a structured JSON analysis.

Ticket:
Title: ${redacted.title}
Description: ${redacted.description}
Customer: ${redacted.customerName}
Product Area: ${redacted.productArea}
Status: ${redacted.status}
Priority: ${redacted.priority}

Messages:
${redacted.messages.map((m) => `${m.authorName} (${m.authorType}): ${m.content}`).join('\n')}

Return ONLY valid JSON matching this exact schema (no extra fields, no markdown):
{
  "extractedSignals": {
    "product": "string or omit if unknown",
    "platform": "web|mobile|desktop|api or omit if unknown",
    "os": "string or omit if unknown",
    "browser": "string or omit if unknown",
    "appVersion": "string or omit if unknown",
    "device": "string or omit if unknown",
    "errorStrings": ["array of exact error messages found in ticket, use [] if none"],
    "urls": ["array of URLs mentioned in ticket, use [] if none"]
  },
  "hypotheses": [
    {
      "cause": "concise description of a possible root cause",
      "evidence": ["supporting quote or observation from the ticket"],
      "confidence": 0.0,
      "tests": ["step to confirm or rule out this hypothesis"]
    }
  ],
  "clarifyingQuestions": ["question to ask the customer to gather missing info"],
  "nextSteps": ["concrete action for the support agent"],
  "riskFlags": ["any risk or concern that warrants attention"],
  "escalationWhen": ["condition under which this ticket should be escalated"]
}

Rules:
- confidence must be a number between 0 and 1 (e.g. 0.85)
- errorStrings and urls must always be arrays (use [] if empty)
- hypotheses, clarifyingQuestions, nextSteps, riskFlags, escalationWhen must always be arrays
- Do not include any field not listed in the schema above`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a support ticket analysis assistant. Always respond with valid JSON only. No markdown, no explanation, just the JSON object.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const rawResult = JSON.parse(completion.choices[0].message.content || '{}');

  // Validate with Zod — repair-once on failure
  const parsed = AnalysisResultSchema.safeParse(rawResult);

  if (parsed.success) {
    return parsed.data;
  }

  // One repair attempt: send the validation errors back to the LLM to fix
  const repairCompletion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a JSON repair assistant. Return only the corrected JSON object, no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `The JSON you returned failed schema validation. Fix it and return ONLY valid JSON.

Validation errors:
${JSON.stringify(parsed.error.issues, null, 2)}

Original JSON to fix:
${JSON.stringify(rawResult, null, 2)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const repairedRaw = JSON.parse(
    repairCompletion.choices[0].message.content || '{}',
  );

  // Hard parse on repair — throws ZodError if still invalid, caught by executeAsyncJob
  return AnalysisResultSchema.parse(repairedRaw);
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
