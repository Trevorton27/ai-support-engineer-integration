// Validation utilities for ticket form fields and file uploads

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FILE_TYPES = ['.txt', '.log', '.png', '.jpg', '.jpeg', '.gif', '.json', '.csv'];

export function validateSubject(subject: string): string | null {
  if (!subject.trim()) return 'Subject is required';
  if (subject.length > 200) return 'Subject must be under 200 characters';
  return null;
}

export function validateMessage(message: string): string | null {
  if (!message.trim()) return 'Message content is required';
  if (message.length > 10000) return 'Message must be under 10,000 characters';
  return null;
}

export function validateFileType(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_FILE_TYPES.includes(ext);
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}
