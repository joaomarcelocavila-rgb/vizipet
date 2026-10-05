import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super({ statusCode, code, message, details }, statusCode);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppException(400, code, message, details);
export const forbidden = (code: string, message: string) => new AppException(403, code, message);
export const notFound = (code: string, message: string) => new AppException(404, code, message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppException(409, code, message, details);
