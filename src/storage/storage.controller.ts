import { Controller, Get, Inject, NotFoundException, Optional, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

const MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };

/** Entrega arquivos do driver local por link assinado e curto. Não existe com o driver Supabase. */
@ApiExcludeController()
@Controller('storage')
export class StorageController {
  constructor(@Inject(StorageService) @Optional() private readonly storage?: StorageService) {}

  @Get('files')
  async download(
    @Query('path') path: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const local = this.storage instanceof LocalStorageService ? this.storage : null;
    if (!local || !local.verify(path, Number(expires), signature)) throw new NotFoundException();

    const buffer = await local.read(path).catch(() => null);
    if (!buffer) throw new NotFoundException();

    res.setHeader('Content-Type', MIME[path.split('.').pop() ?? ''] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
