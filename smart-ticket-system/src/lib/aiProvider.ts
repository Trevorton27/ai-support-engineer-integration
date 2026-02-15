import OpenAI from 'openai';
import type { TicketSnapshot } from './crmClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeTicket(ticket: TicketSnapshot) {
  const prompt = `Analyze this support ticket and provide:
1. A concise summary
2. Sentiment (positive/neutral/negative)
3. Category (technical/billing/feature-request/bug/other)

Ticket:
Title: ${ticket.title}
Description: ${ticket.description}
Customer: ${ticket.customerName}
Product Area: ${ticket.productArea}

Messages:
${ticket.messages.map((m) => `${m.authorName} (${m.authorType}): ${m.content}`).join('\n')}

Respond in JSON format: { "summary": "...", "sentiment": "...", "category": "..." }`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a support ticket analysis assistant.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');

  return {
    summary: result.summary || '',
    sentiment: result.sentiment || 'neutral',
    category: result.category || 'other',
  };
}

export async function suggestNextSteps(ticket: TicketSnapshot) {
  const prompt = `Based on this support ticket, suggest 3-5 actionable next steps for the support agent.

Ticket: ${ticket.title}
Status: ${ticket.status}
Priority: ${ticket.priority}

Return JSON: { "steps": ["step1", "step2", ...] }`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a support workflow assistant.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  return { steps: result.steps || [] };
}

export async function draftReply(
  ticket: TicketSnapshot,
  tone: 'professional' | 'friendly' | 'concise',
) {
  const toneInstructions = {
    professional: 'formal and respectful',
    friendly: 'warm and conversational',
    concise: 'brief and to-the-point',
  };

  const prompt = `Draft a ${toneInstructions[tone]} reply to this customer.

Ticket: ${ticket.title}
Latest message: ${ticket.messages[ticket.messages.length - 1]?.content || ticket.description}

Return JSON: { "reply": "..." }`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a customer support agent.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  return { reply: result.reply || '' };
}

export async function chatAboutTicket(
  ticket: TicketSnapshot,
  question: string,
) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are helping analyze this ticket: ${ticket.title}`,
      },
      { role: 'user', content: question },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  return {
    answer: result.answer || completion.choices[0].message.content || '',
  };
}
