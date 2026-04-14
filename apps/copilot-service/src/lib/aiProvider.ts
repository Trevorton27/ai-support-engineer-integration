import OpenAI from 'openai';
import type { TicketSnapshot } from './crmClient';
import { redactTicketSnapshot } from './redaction';
import {
  AnalysisResultSchema,
  NextStepsResultSchema,
  DraftReplyResultSchema,
  ChatResultSchema,
  DraftCustomerReplyResultSchema,
  DraftInternalNoteResultSchema,
  DraftEscalationResultSchema,
  type AnalysisResult,
  type NextStepsResult,
  type DraftReplyResult,
  type ChatResult,
  type DraftCustomerReplyResult,
  type DraftInternalNoteResult,
  type DraftEscalationResult,
} from './schemas';

type RedactedTicket = ReturnType<typeof redactTicketSnapshot>;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAI() as unknown as Record<string | symbol, unknown>;
    return client[prop];
  },
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
  tone: 'professional' | 'friendly' | 'concise' | 'surfer',
): Promise<DraftReplyResult> {
  // Redact sensitive data
  const redacted = redactTicketSnapshot(ticket);

  const toneInstructions = {
    professional: 'formal and respectful',
    friendly: 'warm and conversational',
    concise: 'brief and to-the-point',
    surfer: 'like a stereotypical California surfer dude — use surfing slang, say things like "dude", "bro", "totally", "gnarly", "stoked", "hang ten", "radical", "no worries", and keep the vibe super chill and laid-back',
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

// ============================================================
// Phase 3 — Draft Generation (customer_reply, internal_note, escalation)
// ============================================================

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'formal and respectful',
  friendly: 'warm and conversational',
  concise: 'brief and to-the-point',
  surfer:
    'like a stereotypical California surfer dude — use surfing slang, say things like "dude", "bro", "totally", "gnarly", "stoked", "hang ten", "radical", "no worries", and keep the vibe super chill and laid-back',
};

function formatTicketContext(redacted: RedactedTicket): string {
  return `Title: ${redacted.title}
Description: ${redacted.description}
Customer: ${redacted.customerName}
Product Area: ${redacted.productArea}
Status: ${redacted.status}
Priority: ${redacted.priority}

Messages:
${redacted.messages.map((m) => `${m.authorName} (${m.authorType}): ${m.content}`).join('\n')}`;
}

function formatAnalysisContext(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return 'No prior analysis available — infer context from the ticket above.';
  }

  const sig = analysis.extractedSignals;
  const signalLines = [
    sig.product && `product=${sig.product}`,
    sig.platform && `platform=${sig.platform}`,
    sig.os && `os=${sig.os}`,
    sig.browser && `browser=${sig.browser}`,
    sig.appVersion && `appVersion=${sig.appVersion}`,
    sig.device && `device=${sig.device}`,
  ].filter(Boolean);

  return `Prior Analysis:
Signals: ${signalLines.length ? signalLines.join(', ') : '(none)'}
Error Strings: ${sig.errorStrings.length ? sig.errorStrings.join(' | ') : '(none)'}
URLs: ${sig.urls.length ? sig.urls.join(' | ') : '(none)'}

Hypotheses:
${analysis.hypotheses
  .map(
    (h, i) =>
      `${i + 1}. ${h.cause} (confidence=${h.confidence})
   Evidence: ${h.evidence.join('; ') || '(none)'}
   Tests: ${h.tests.join('; ') || '(none)'}`,
  )
  .join('\n') || '(none)'}

Clarifying Questions: ${analysis.clarifyingQuestions.join(' | ') || '(none)'}
Next Steps: ${analysis.nextSteps.join(' | ') || '(none)'}
Risk Flags: ${analysis.riskFlags.join(' | ') || '(none)'}
Escalation When: ${analysis.escalationWhen.join(' | ') || '(none)'}`;
}

export function buildCustomerReplyPrompt(
  redacted: RedactedTicket,
  analysis: AnalysisResult | null,
  tone: string,
): string {
  const toneDesc = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional;
  const latestMessage =
    redacted.messages[redacted.messages.length - 1]?.content ||
    redacted.description;

  return `You are a senior support engineer drafting a customer-facing reply.

Ticket:
${formatTicketContext(redacted)}

${formatAnalysisContext(analysis)}

Last customer message to respond to:
"${latestMessage}"

Write a reply in a ${toneDesc} tone. The reply MUST include all of:
1. An empathy opening sentence that acknowledges the customer's experience.
2. 3 to 5 numbered action steps (concrete next actions the customer or you will take).
3. 1 to 3 clarifying questions to help narrow down the issue.
4. A reassuring closing sentence.

Hard constraints:
- Total length UNDER 2000 characters.
- Do not expose internal hypotheses or confidence scores verbatim.
- Use prior analysis to inform the steps and questions when available.

Return ONLY valid JSON in this exact shape:
{ "text": "<the full reply as a single string>" }`;
}

export function buildInternalNotePrompt(
  redacted: RedactedTicket,
  analysis: AnalysisResult | null,
): string {
  return `You are a senior support engineer writing an INTERNAL note for other agents. Not customer-facing.

Ticket:
${formatTicketContext(redacted)}

${formatAnalysisContext(analysis)}

Write a technical internal note. Use direct, technical language — do NOT soften for the customer. The note MUST include the following labeled sections:

Summary: 1-2 sentences describing the issue.
Hypotheses: reference the top hypothesis causes with supporting evidence from the analysis.
What Was Tried: what the customer or team has already attempted (infer from messages).
Recommended Next: concrete actions to take next.

Hard constraints:
- Total length UNDER 5000 characters.
- Cite specific evidence / error strings from the analysis where relevant.

Return ONLY valid JSON in this exact shape:
{ "text": "<the full internal note as a single string>" }`;
}

export function buildEscalationPrompt(
  redacted: RedactedTicket,
  analysis: AnalysisResult | null,
): string {
  return `You are a senior support engineer writing an ESCALATION HANDOFF to an engineering team.

Ticket:
${formatTicketContext(redacted)}

${formatAnalysisContext(analysis)}

Write a structured escalation. The handoff MUST include the following labeled sections:

Summary: 2-3 sentences.
Reproduction Steps: numbered steps to reproduce (infer from ticket messages).
Environment: OS, browser, appVersion, device — pulled from the analysis signals.
Logs / Error Strings: relevant error strings, log lines, or URLs from the analysis.
Top Hypotheses: list the top hypothesis causes with their confidence scores.
Ask: a specific, actionable request for the engineering team (what they need to do, what decision, what investigation).

Hard constraints:
- Total length UNDER 5000 characters.
- Be specific. Engineers should not have to re-read the full ticket to act.

Return ONLY valid JSON in this exact shape:
{ "text": "<the full escalation handoff as a single string>" }`;
}

async function generateDraftText(
  prompt: string,
  systemRole: string,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${systemRole} Always respond with valid JSON only, in the shape { "text": "..." }. No markdown, no extra fields.`,
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(completion.choices[0].message.content || '{}');
  if (typeof raw.text !== 'string' || raw.text.length === 0) {
    throw new Error('LLM returned empty or invalid draft text');
  }
  return raw.text;
}

export async function draftCustomerReply(
  ticket: TicketSnapshot,
  analysis: AnalysisResult | null,
  analysisId: string | null,
  tone: 'professional' | 'friendly' | 'concise' | 'surfer',
): Promise<DraftCustomerReplyResult> {
  const redacted = redactTicketSnapshot(ticket);
  const prompt = buildCustomerReplyPrompt(redacted, analysis, tone);
  const text = await generateDraftText(
    prompt,
    'You are a customer support agent drafting a customer-facing reply.',
  );

  return DraftCustomerReplyResultSchema.parse({
    text,
    draftType: 'customer_reply',
    tone,
    usedAnalysisId: analysisId,
    markedSent: false,
  });
}

export async function draftInternalNote(
  ticket: TicketSnapshot,
  analysis: AnalysisResult | null,
  analysisId: string | null,
): Promise<DraftInternalNoteResult> {
  const redacted = redactTicketSnapshot(ticket);
  const prompt = buildInternalNotePrompt(redacted, analysis);
  const text = await generateDraftText(
    prompt,
    'You are a senior support engineer writing an internal technical note.',
  );

  return DraftInternalNoteResultSchema.parse({
    text,
    draftType: 'internal_note',
    usedAnalysisId: analysisId,
    markedSent: false,
  });
}

export async function draftEscalation(
  ticket: TicketSnapshot,
  analysis: AnalysisResult | null,
  analysisId: string | null,
): Promise<DraftEscalationResult> {
  const redacted = redactTicketSnapshot(ticket);
  const prompt = buildEscalationPrompt(redacted, analysis);
  const text = await generateDraftText(
    prompt,
    'You are a senior support engineer writing an escalation handoff to engineering.',
  );

  return DraftEscalationResultSchema.parse({
    text,
    draftType: 'escalation',
    usedAnalysisId: analysisId,
    markedSent: false,
  });
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
