import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export class Paginated<T> {
  constructor(
    readonly data: T[],
    readonly meta: { page: number; limit: number; total: number; totalPages: number },
  ) {}
}

export function paginated<T>(items: T[], page: number, limit: number, total: number) {
  return new Paginated(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        if (result === undefined) return result;
        if (result instanceof Paginated) return { data: result.data, meta: result.meta };
        return { data: result };
      }),
    );
  }
}
