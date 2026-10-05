import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { checkPublicHttpsUrl } from '../utils/safe-url';

export function IsPublicHttpsUrl(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isPublicHttpsUrl',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && checkPublicHttpsUrl(value).ok,
        defaultMessage: (args: ValidationArguments) => {
          const result = typeof args.value === 'string' ? checkPublicHttpsUrl(args.value) : null;
          return `${args.property}: ${result && !result.ok ? result.reason : 'URL inválida.'}`;
        },
      },
    });
}
