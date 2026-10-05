import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../app-exception';

function flatten(errors: ValidationError[], parent = ''): { field: string; errors: string[] }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      new AppException(400, 'VALIDATION_ERROR', 'Campo ausente ou inválido.', flatten(errors)),
  });
}
