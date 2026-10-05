import { Module } from '@nestjs/common';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [ProfessionalsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
