import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [VerificationModule, ProfessionalsModule, ClinicsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
