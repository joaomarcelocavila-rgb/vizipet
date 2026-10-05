import { randomUUID } from 'node:crypto';
import { badRequest, AppException } from '../common/app-exception';

export type UploadKind = 'photo' | 'document';

export interface DetectedFile {
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  extension: 'pdf' | 'jpg' | 'png';
}

export const MAX_BYTES: Record<UploadKind, number> = {
  photo: 5 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

const ALLOWED: Record<UploadKind, DetectedFile['mime'][]> = {
  photo: ['image/jpeg', 'image/png'],
  document: ['application/pdf', 'image/jpeg', 'image/png'],
};

const DANGEROUS_INNER_EXTENSIONS = new Set([
  'exe',
  'dll',
  'bat',
  'cmd',
  'com',
  'msi',
  'sh',
  'ps1',
  'php',
  'phtml',
  'js',
  'mjs',
  'jsp',
  'asp',
  'aspx',
  'html',
  'htm',
  'svg',
  'xml',
  'zip',
  'rar',
  '7z',
  'jar',
  'py',
  'rb',
  'pl',
  'cgi',
  'scr',
]);

export function detectFile(buffer: Buffer): DetectedFile | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && png.every((byte, i) => buffer[i] === byte)) {
    return { mime: 'image/png', extension: 'png' };
  }
  return null;
}

export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'arquivo';
}

export interface ValidatedUpload extends DetectedFile {
  displayName: string;
  sizeBytes: number;
  storagePath: string;
}

export function validateUpload(
  file: { buffer: Buffer; originalname: string; size?: number } | undefined,
  kind: UploadKind,
): ValidatedUpload {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw badRequest('FILE_REQUIRED', 'Envie um arquivo.');
  }
  if (file.buffer.length > MAX_BYTES[kind]) {
    throw new AppException(413, 'FILE_TOO_LARGE', `Arquivo acima de ${MAX_BYTES[kind] / 1024 / 1024} MB.`);
  }

  const displayName = safeDisplayName(file.originalname);
  const parts = displayName.toLowerCase().split('.');
  const declared = parts.length > 1 ? parts[parts.length - 1] : '';
  const inner = parts.slice(1, -1);
  if (inner.some((part) => DANGEROUS_INNER_EXTENSIONS.has(part))) {
    throw badRequest('FILE_TYPE_NOT_ALLOWED', 'Nome de arquivo não permitido.');
  }

  const detected = detectFile(file.buffer);
  if (!detected || !ALLOWED[kind].includes(detected.mime)) {
    throw badRequest('FILE_TYPE_NOT_ALLOWED', 'Formato não aceito. Use PDF, JPEG ou PNG.');
  }
  const acceptedExtensions = detected.extension === 'jpg' ? ['jpg', 'jpeg'] : [detected.extension];
  if (!acceptedExtensions.includes(declared)) {
    throw badRequest('FILE_TYPE_MISMATCH', 'A extensão não corresponde ao conteúdo do arquivo.');
  }

  return {
    ...detected,
    displayName,
    sizeBytes: file.buffer.length,
    storagePath: `${kind}s/${randomUUID()}.${detected.extension}`,
  };
}
