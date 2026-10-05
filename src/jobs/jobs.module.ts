import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { HttpSourceChecker, SourceChecker } from './source-checker';

@Module({
  controllers: [JobsController],
  providers: [JobsService, { provide: SourceChecker, useClass: HttpSourceChecker }],
  exports: [JobsService],
})
export class JobsModule {}
