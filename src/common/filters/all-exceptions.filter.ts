import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'ACCESS_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as any).requestId;

    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Erro interno. Informe o requestId ao suporte.';
    let details: unknown;

    if (exception instanceof ThrottlerException) {
      statusCode = 429;
      code = 'RATE_LIMITED';
      message = 'Muitas tentativas. Aguarde um instante e tente de novo.';
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      code = STATUS_CODES[statusCode] ?? 'ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as Record<string, unknown>;
        if (typeof payload.code === 'string') code = payload.code;
        if (Array.isArray(payload.message)) {
          message = 'Dados inválidos.';
          details = payload.message;
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        }
        if (payload.details !== undefined) details = payload.details;
      }
    }

    if (statusCode >= 500) {
      // Só a classe e o requestId: a mensagem original pode carregar dados da consulta.
      const name = exception instanceof Error ? exception.constructor.name : typeof exception;
      this.logger.error(`${req.method} ${req.path} falhou (${name}) requestId=${requestId}`);
    }

    res.status(statusCode).json({
      statusCode,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId,
    });
  }
}
