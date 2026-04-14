import type { TicketSnapshot } from './crmClient';

// Email redaction
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// API keys, tokens, secrets (common patterns)
const API_KEY_PATTERNS = [
  /\b(sk|pk|api|secret|token)[_-]?[A-Za-z0-9]{20,}\b/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bghp_[A-Za-z0-9]{36}\b/g, // GitHub tokens
  /\bglpat-[A-Za-z0-9\-_]{20}\b/g, // GitLab tokens
];

export type RedactionResult = {
  redactedText: string;
  hasRedactions: boolean;
  redactionCount: number;
};

export function redactSensitiveData(text: string): RedactionResult {
  let redacted = text;
  let count = 0;

  // Redact emails
  const emailMatches = text.match(EMAIL_REGEX);
  if (emailMatches) {
    count += emailMatches.length;
    redacted = redacted.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');
  }

  // Redact API keys and tokens
  for (const pattern of API_KEY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
      redacted = redacted.replace(pattern, '[TOKEN_REDACTED]');
    }
  }

  return {
    redactedText: redacted,
    hasRedactions: count > 0,
    redactionCount: count,
  };
}

// Redact from ticket snapshot
export function redactTicketSnapshot(snapshot: TicketSnapshot): TicketSnapshot {
  return {
    ...snapshot,
    description: redactSensitiveData(snapshot.description).redactedText,
    messages: snapshot.messages.map((msg) => ({
      ...msg,
      content: redactSensitiveData(msg.content).redactedText,
    })),
  };
}
