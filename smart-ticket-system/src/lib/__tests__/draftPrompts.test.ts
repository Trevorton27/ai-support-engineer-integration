import { describe, it, expect } from 'vitest';
import {
  buildCustomerReplyPrompt,
  buildInternalNotePrompt,
  buildEscalationPrompt,
} from '../aiProvider';
import type { AnalysisResult } from '../schemas';
import type { TicketSnapshot } from '../crmClient';

const mockTicket: TicketSnapshot = {
  id: 'cl_ticket_1',
  title: 'Cannot upload files larger than 10MB',
  description: 'Uploads fail consistently when file exceeds 10MB.',
  status: 'OPEN',
  priority: 'HIGH',
  customerName: 'Jane Doe',
  productArea: 'File Upload',
  messages: [
    {
      authorType: 'CUSTOMER',
      authorName: 'Jane Doe',
      content: 'Hi team, I cannot upload my 15MB PDF. It just hangs.',
    },
    {
      authorType: 'AGENT',
      authorName: 'Support Agent',
      content: 'Could you share the browser console output?',
    },
    {
      authorType: 'CUSTOMER',
      authorName: 'Jane Doe',
      content:
        'The console shows "Request Entity Too Large" when I try to upload.',
    },
  ],
};

const mockAnalysis: AnalysisResult = {
  extractedSignals: {
    product: 'Acme CRM',
    platform: 'web',
    os: 'macOS 14',
    browser: 'Chrome 120',
    appVersion: '2.4.1',
    device: 'Desktop',
    errorStrings: ['Request Entity Too Large'],
    urls: ['https://app.example.com/uploads'],
  },
  hypotheses: [
    {
      cause: 'Server-side upload size limit set below client expectation',
      evidence: ['Request Entity Too Large error returned by server'],
      confidence: 0.9,
      tests: ['Check nginx client_max_body_size', 'Check app upload config'],
    },
    {
      cause: 'CDN/proxy stripping large request body',
      evidence: ['Upload hangs silently on some attempts'],
      confidence: 0.4,
      tests: ['Bypass CDN and retry'],
    },
  ],
  clarifyingQuestions: ['Does this fail for all file types?'],
  nextSteps: ['Increase server upload limit to 50MB'],
  riskFlags: ['Customer is on enterprise plan'],
  escalationWhen: ['If fix requires infra change'],
};

describe('buildCustomerReplyPrompt', () => {
  it('includes the ticket title', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'professional');
    expect(prompt).toContain(mockTicket.title);
  });

  it('includes the last customer message', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'professional');
    const last = mockTicket.messages[mockTicket.messages.length - 1].content;
    expect(prompt).toContain(last);
  });

  it('includes the top hypothesis cause from analysis', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'professional');
    expect(prompt).toContain(mockAnalysis.hypotheses[0].cause);
  });

  it('enforces empathy + steps + questions + reassurance', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'professional');
    expect(prompt).toMatch(/empathy/i);
    expect(prompt).toMatch(/numbered action steps/i);
    expect(prompt).toMatch(/clarifying questions/i);
    expect(prompt).toMatch(/reassuring/i);
  });

  it('enforces 2000-character hard constraint', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'professional');
    expect(prompt).toMatch(/2000/);
  });

  it('reflects the requested tone in instructions', () => {
    const friendly = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'friendly');
    expect(friendly).toMatch(/warm and conversational/);
    const surfer = buildCustomerReplyPrompt(mockTicket, mockAnalysis, 'surfer');
    expect(surfer).toMatch(/surfer/i);
  });

  it('falls back gracefully when analysis is null', () => {
    const prompt = buildCustomerReplyPrompt(mockTicket, null, 'professional');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toMatch(/No prior analysis/i);
    // Still includes ticket context
    expect(prompt).toContain(mockTicket.title);
  });
});

describe('buildInternalNotePrompt', () => {
  it('includes evidence from top hypothesis', () => {
    const prompt = buildInternalNotePrompt(mockTicket, mockAnalysis);
    expect(prompt).toContain(mockAnalysis.hypotheses[0].evidence[0]);
  });

  it('requests hypotheses, tried, and recommended next sections', () => {
    const prompt = buildInternalNotePrompt(mockTicket, mockAnalysis);
    expect(prompt).toMatch(/Hypotheses/);
    expect(prompt).toMatch(/What Was Tried/);
    expect(prompt).toMatch(/Recommended Next/);
  });

  it('enforces 5000-character hard constraint', () => {
    const prompt = buildInternalNotePrompt(mockTicket, mockAnalysis);
    expect(prompt).toMatch(/5000/);
  });

  it('handles null analysis without throwing', () => {
    const prompt = buildInternalNotePrompt(mockTicket, null);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

describe('buildEscalationPrompt', () => {
  it('includes error strings from analysis', () => {
    const prompt = buildEscalationPrompt(mockTicket, mockAnalysis);
    expect(prompt).toContain(mockAnalysis.extractedSignals.errorStrings[0]);
  });

  it('includes environment signals (browser, appVersion)', () => {
    const prompt = buildEscalationPrompt(mockTicket, mockAnalysis);
    expect(prompt).toContain('Chrome 120');
    expect(prompt).toContain('2.4.1');
  });

  it('requests summary, repro, env, logs, hypotheses, ask sections', () => {
    const prompt = buildEscalationPrompt(mockTicket, mockAnalysis);
    expect(prompt).toMatch(/Summary/);
    expect(prompt).toMatch(/Reproduction Steps/);
    expect(prompt).toMatch(/Environment/);
    expect(prompt).toMatch(/Logs/);
    expect(prompt).toMatch(/Top Hypotheses/);
    expect(prompt).toMatch(/Ask/);
  });

  it('handles null analysis without throwing', () => {
    const prompt = buildEscalationPrompt(mockTicket, null);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
