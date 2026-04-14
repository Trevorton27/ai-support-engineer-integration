import { prisma } from './prisma';
import type { ChatHistoryMessage } from './aiProvider';

const MAX_STORED_TURNS = 40; // Keep last ~20 user/assistant exchanges

export async function loadConversation(
  ticketId: string,
): Promise<ChatHistoryMessage[]> {
  const row = await prisma.aIConversation.findFirst({
    where: { ticketId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!row) return [];
  const raw = (row.messages as unknown as ChatHistoryMessage[]) ?? [];
  return Array.isArray(raw) ? raw : [];
}

export async function appendChatTurn(
  ticketId: string,
  newMessages: ChatHistoryMessage[],
): Promise<void> {
  const existing = await loadConversation(ticketId);
  const combined = [...existing, ...newMessages].slice(-MAX_STORED_TURNS);

  const row = await prisma.aIConversation.findFirst({
    where: { ticketId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  if (row) {
    await prisma.aIConversation.update({
      where: { id: row.id },
      data: { messages: combined },
    });
  } else {
    await prisma.aIConversation.create({
      data: { ticketId, messages: combined },
    });
  }
}

export async function clearConversation(ticketId: string): Promise<void> {
  await prisma.aIConversation.deleteMany({ where: { ticketId } });
}
