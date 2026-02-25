import { z } from 'zod';

// Analysis response schema with strict structure
export const AnalysisResultSchema = z.object({
  summary: z.string().min(1).max(500),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  category: z.enum(['technical', 'billing', 'feature-request', 'bug', 'other']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  suggestedActions: z.array(z.string()).max(5).optional(),
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
