import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [ProfessionalsModule, ClinicsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
