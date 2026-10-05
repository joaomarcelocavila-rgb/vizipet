import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { notFound } from '../common/app-exception';
import { CronSecretGuard } from './cron-secret.guard';
import { JOB_NAMES, JobName, JobsService } from './jobs.service';

@ApiTags('Jobs')
@SkipThrottle()
@Controller('internal/jobs')
@UseGuards(CronSecretGuard)
@ApiHeader({ name: 'X-Cron-Secret', required: true })
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post(':name')
  @HttpCode(200)
  @ApiOperation({ summary: 'Executa uma rotina agendada: outbox, reminders, campaigns, sources ou all' })
  run(@Param('name') name: string) {
    if (!(JOB_NAMES as readonly string[]).includes(name)) throw notFound('JOB_NOT_FOUND', 'Rotina inexistente.');
    return this.jobs.run(name as JobName);
  }
}
