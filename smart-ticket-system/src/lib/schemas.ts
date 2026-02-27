import { z } from 'zod';

// Analysis response schema with rich structured output (Phase 2)
export const AnalysisResultSchema = z.object({
  extractedSignals: z.object({
    product: z.string().optional(),
    platform: z.string().optional(),
    os: z.string().optional(),
    browser: z.string().optional(),
    appVersion: z.string().optional(),
    device: z.string().optional(),
    errorStrings: z.array(z.string()),
    urls: z.array(z.string()),
  }),
  hypotheses: z.array(
    z.object({
      cause: z.string(),
      evidence: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      tests: z.array(z.string()),
    }),
  ),
  clarifyingQuestions: z.array(z.string()),
  nextSteps: z.array(z.string()),
  riskFlags: z.array(z.string()),
  escalationWhen: z.array(z.string()),
});

export const NextStepsResultSchema = z.object({
  steps: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const DraftReplyResultSchema = z.object({
  reply: z.string().min(1).max(2000),
  tone: z.enum(['professional', 'friendly', 'concise']).optional(),
});

export const ChatResultSchema = z.object({
  answer: z.string().min(1).max(1000),
});

// API request schemas
export const AnalyzeRequestSchema = z.object({
  ticketId: z.string().cuid(),
});

export const SuggestRequestSchema = z.object({
  ticketId: z.string().cuid(),
});

export const DraftReplyRequestSchema = z.object({
  ticketId: z.string().cuid(),
  tone: z.enum(['professional', 'friendly', 'concise']).default('professional'),
});

export const ChatRequestSchema = z.object({
  ticketId: z.string().cuid(),
  message: z.string().min(1).max(1000),
});

// Inferred types
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type NextStepsResult = z.infer<typeof NextStepsResultSchema>;
export type DraftReplyResult = z.infer<typeof DraftReplyResultSchema>;
export type ChatResult = z.infer<typeof ChatResultSchema>;
