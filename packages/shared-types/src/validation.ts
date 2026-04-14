export const ALLOWED_FILE_TYPES = [
  '.txt', '.log', '.png', '.jpg', '.jpeg', '.gif', '.json', '.csv',
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateSubject(subject: string): string | null {
  if (!subject.trim()) return 'Subject is required';
  if (subject.length > 200) return 'Subject must be under 200 characters';
  return null;
}

export function validateMessage(content: string): string | null {
  if (!content.trim()) return 'Message content is required';
  if (content.length > 10000) return 'Message must be under 10,000 characters';
  return null;
}

export function validateFileType(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_FILE_TYPES.includes(ext);
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}
