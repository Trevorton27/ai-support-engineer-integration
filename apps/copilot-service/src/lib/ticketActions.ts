'use server';

import { revalidatePath } from 'next/cache';
import { generateDummyTickets as crmGenerateDummyTickets } from './crmClient';

export async function generateDummyTickets() {
  const result = await crmGenerateDummyTickets();
  if (!result.ok) throw new Error(result.error);
  revalidatePath('/tickets');
}
