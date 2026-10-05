import { Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { notFound } from '../app-exception';

// Um id malformado nunca existirá: responde 404 em vez de vazar erro do banco.
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!isUUID(value)) throw notFound('NOT_FOUND', 'Recurso não encontrado.');
    return value;
  }
}
