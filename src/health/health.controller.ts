import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';

@ApiTags('Infra')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check com consulta ao banco' })
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(503, 'DATABASE_UNAVAILABLE', 'Banco de dados indisponível.');
    }
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('version')
  @ApiOperation({ summary: 'Versão da API' })
  version() {
    return { name: 'vizipet-backend', version: process.env.npm_package_version ?? '0.1.0' };
  }
}
