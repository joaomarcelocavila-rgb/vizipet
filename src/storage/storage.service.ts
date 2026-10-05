import { ValidatedUpload, validateUpload, UploadKind } from './file-validator';

export interface StoredFile {
  path: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
}

/**
 * Contrato de armazenamento usado por pets (foto) e verificação (documentos).
 * Os drivers só gravam bytes já validados; nada aqui é público.
 */
export abstract class StorageService {
  async save(file: IncomingFile | undefined, kind: UploadKind): Promise<StoredFile> {
    const upload = validateUpload(file, kind);
    await this.write(upload.storagePath, file!.buffer, upload.mime);
    return this.describe(upload);
  }

  /** Link temporário de leitura. O caminho nunca é exposto fora do back end. */
  abstract createSignedUrl(path: string, ttlSeconds: number): Promise<string>;
  abstract remove(path: string): Promise<void>;
  protected abstract write(path: string, buffer: Buffer, mime: string): Promise<void>;

  private describe(upload: ValidatedUpload): StoredFile {
    return {
      path: upload.storagePath,
      mimeType: upload.mime,
      sizeBytes: upload.sizeBytes,
      originalName: upload.displayName,
    };
  }
}
