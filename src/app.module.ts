import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClinicsModule } from './clinics/clinics.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PetsModule } from './pets/pets.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { SearchModule } from './search/search.module';
import { ServicesModule } from './services/services.module';
import { StorageModule } from './storage/storage.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [{ ttl: 60_000, limit: config.get('THROTTLE_LIMIT') }],
    }),
    PrismaModule,
    AuthModule,
    PetsModule,
    StorageModule,
    MailModule,
    AuditModule,
    NotificationsModule,
    ProfessionalsModule,
    ClinicsModule,
    ServicesModule,
    AvailabilityModule,
    SearchModule,
    VerificationModule,
    AppointmentsModule,
    CampaignsModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
