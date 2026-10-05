import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { AdminService } from './admin.service';
import { AuditQuery, DecisionDto, ListVerificationRequestsQuery, ProviderActionDto } from './dto/admin.dto';

@ApiTags('Administração')
@Controller('admin')
@Protected('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('verification-requests')
  @ApiOperation({ summary: 'Fila de verificação (sem documentos)' })
  list(@Query() query: ListVerificationRequestsQuery) {
    return this.admin.listRequests(query);
  }

  @Get('verification-requests/:id')
  @ApiOperation({ summary: 'Detalhe do pedido, com metadados dos documentos e o que ainda falta' })
  get(@Param('id', ParseIdPipe) id: string) {
    return this.admin.getRequest(id);
  }

  @Post('verification-requests/:id/documents/:documentId/link')
  @HttpCode(200)
  @ApiOperation({ summary: 'Link temporário (2 min) de um documento. A visualização é auditada.' })
  link(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Param('documentId', ParseIdPipe) documentId: string,
  ) {
    return this.admin.createDocumentLink(admin.id, id, documentId);
  }

  @Post('verification-requests/:id/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aprova, pede correção ou rejeita. Correção e rejeição exigem justificativa.' })
  decide(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIdPipe) id: string, @Body() dto: DecisionDto) {
    return this.admin.decide(admin.id, id, dto);
  }

  @Post('professionals/:id/suspend')
  @HttpCode(200)
  suspendProfessional(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ProviderActionDto,
  ) {
    return this.admin.suspend(admin.id, 'professionals', id, dto.reason);
  }

  @Post('professionals/:id/reinstate')
  @HttpCode(200)
  reinstateProfessional(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ProviderActionDto,
  ) {
    return this.admin.reinstate(admin.id, 'professionals', id, dto.reason);
  }

  @Post('clinics/:id/suspend')
  @HttpCode(200)
  suspendClinic(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ProviderActionDto,
  ) {
    return this.admin.suspend(admin.id, 'clinics', id, dto.reason);
  }

  @Post('clinics/:id/reinstate')
  @HttpCode(200)
  reinstateClinic(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ProviderActionDto,
  ) {
    return this.admin.reinstate(admin.id, 'clinics', id, dto.reason);
  }

  @Get('audit-logs')
  audit(@Query() query: AuditQuery) {
    return this.admin.listAudit(query);
  }
}
