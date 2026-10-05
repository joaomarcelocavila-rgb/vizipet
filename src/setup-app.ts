import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfig } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { createValidationPipe } from './common/pipes/validation';

export function setupApp(app: INestApplication) {
  const config = app.get(AppConfig);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  if (config.get('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Vizipet API')
        .setDescription('Back end do Vizipet. Respostas de sucesso vêm em { data } (e { data, meta } nas listas).')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
