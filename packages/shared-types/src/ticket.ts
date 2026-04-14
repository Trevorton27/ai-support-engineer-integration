import { z } from 'zod';

// Shared domain enums
export const TicketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export type TicketStatus = z.infer<typeof TicketStatusEnum>;

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Priority = z.infer<typeof PriorityEnum>;

export const ChannelEnum = z.enum(['EMAIL', 'CHAT', 'PHONE', 'WEB']);
export type Channel = z.infer<typeof ChannelEnum>;

export const AuthorTypeEnum = z.enum(['CUSTOMER', 'AGENT', 'SYSTEM']);
export type AuthorType = z.infer<typeof AuthorTypeEnum>;

// Ticket snapshot — the shape the copilot receives from the CRM
export const TicketMessageSchema = z.object({
  authorType: z.string(),
  authorName: z.string(),
  content: z.string(),
});

export const TicketSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  customerName: z.string(),
  productArea: z.string(),
  messages: z.array(TicketMessageSchema),
});

export type TicketSnapshot = z.infer<typeof TicketSnapshotSchema>;

export const TicketListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  customerName: z.string(),
  productArea: z.string(),
  createdAt: z.string(),
});

export type TicketListItem = z.infer<typeof TicketListItemSchema>;
