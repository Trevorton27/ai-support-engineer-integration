import { describe, it, expect } from 'vitest';
import {
  validateSubject,
  validateMessage,
  validateFileType,
  validateFileSize,
  MAX_FILE_SIZE,
} from '../validation';

describe('validateSubject', () => {
  it('rejects empty subject', () => {
    expect(validateSubject('')).toBe('Subject is required');
  });

  it('rejects whitespace-only subject', () => {
    expect(validateSubject('   ')).toBe('Subject is required');
  });

  it('accepts valid subject', () => {
    expect(validateSubject('Login page broken')).toBeNull();
  });

  it('rejects subject over 200 chars', () => {
    const long = 'a'.repeat(201);
    expect(validateSubject(long)).toBe('Subject must be under 200 characters');
  });
});

describe('validateMessage', () => {
  it('rejects empty message', () => {
    expect(validateMessage('')).toBe('Message content is required');
  });

  it('accepts valid message', () => {
    expect(validateMessage('This is a valid message')).toBeNull();
  });

  it('rejects message over 10000 chars', () => {
    const long = 'x'.repeat(10001);
    expect(validateMessage(long)).toBe(
      'Message must be under 10,000 characters',
    );
  });
});

describe('validateFileType', () => {
  it('accepts .txt', () => {
    expect(validateFileType('log.txt')).toBe(true);
  });

  it('accepts .png', () => {
    expect(validateFileType('screenshot.png')).toBe(true);
  });

  it('accepts .json', () => {
    expect(validateFileType('config.json')).toBe(true);
  });

  it('accepts .log', () => {
    expect(validateFileType('error.log')).toBe(true);
  });

  it('accepts .jpg', () => {
    expect(validateFileType('photo.jpg')).toBe(true);
  });

  it('rejects .exe', () => {
    expect(validateFileType('malware.exe')).toBe(false);
  });

  it('rejects .pdf', () => {
    expect(validateFileType('document.pdf')).toBe(false);
  });

  it('rejects .sh', () => {
    expect(validateFileType('script.sh')).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('accepts valid file size', () => {
    expect(validateFileSize(1024)).toBe(true);
  });

  it('rejects zero size', () => {
    expect(validateFileSize(0)).toBe(false);
  });

  it('rejects oversized file', () => {
    expect(validateFileSize(MAX_FILE_SIZE + 1)).toBe(false);
  });
});
