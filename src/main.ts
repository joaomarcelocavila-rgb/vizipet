import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppConfig } from './config/app-config.service';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  setupApp(app);
  await app.listen(app.get(AppConfig).get('PORT'));
}

void bootstrap();
