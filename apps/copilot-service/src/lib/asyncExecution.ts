import { prisma } from './prisma';

type AsyncJobHandler = () => Promise<any>;

export async function executeAsyncJob(
  suggestionId: string,
  handler: AsyncJobHandler,
): Promise<void> {
  // Run in background using setImmediate to avoid blocking
  setImmediate(async () => {
    try {
      // Mark as running
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: { state: 'running', updatedAt: new Date() },
      });

      // Execute handler
      const result = await handler();

      // Mark as success
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          state: 'success',
          content: result,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      // Mark as error
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          state: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          updatedAt: new Date(),
        },
      });
    }
  });
}
