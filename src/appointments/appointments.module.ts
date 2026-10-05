import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { ServicesModule } from '../services/services.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [ServicesModule, ProfessionalsModule, ClinicsModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
