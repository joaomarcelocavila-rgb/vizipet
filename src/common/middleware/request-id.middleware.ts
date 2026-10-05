import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID_ID = /^[0-9a-f-]{36}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
    (req as any).requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
