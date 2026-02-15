export const ALLOWED_FILE_TYPES = ['.txt', '.log', '.png', '.jpg', '.json'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateSubject(subject: string): string | null {
  if (!subject || subject.trim().length === 0) return 'Subject is required';
  if (subject.trim().length > 200) return 'Subject must be under 200 characters';
  return null;
}

export function validateMessage(content: string): string | null {
  if (!content || content.trim().length === 0)
    return 'Message content is required';
  if (content.trim().length > 10000)
    return 'Message must be under 10,000 characters';
  return null;
}

export function validateFileType(fileName: string): boolean {
  const ext = '.' + (fileName.split('.').pop()?.toLowerCase() ?? '');
  return ALLOWED_FILE_TYPES.includes(ext);
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}
