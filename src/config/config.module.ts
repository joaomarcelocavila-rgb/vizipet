import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config.service';
import { validateEnv } from './env';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => validateEnv(raw) as unknown as Record<string, unknown>,
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class ConfigModule {}
