import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.service';
import { ActiveUserGuard } from './guards/active-user.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UserAccessService } from './user-access.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, ActiveUserGuard, RolesGuard, UserAccessService],
  exports: [JwtModule, JwtAuthGuard, ActiveUserGuard, RolesGuard, UserAccessService],
})
export class AuthModule {}
