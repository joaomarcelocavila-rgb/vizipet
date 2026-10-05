import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { MAX_BYTES } from '../storage/file-validator';
import { DocumentScopeQuery, SubmitVerificationDto, UploadDocumentDto } from './dto/verification.dto';
import { VerificationService } from './verification.service';

@ApiTags('Verificação')
@Controller('verification')
@Protected('PROFESSIONAL')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'target', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        target: { type: 'string', enum: ['PROFESSIONAL', 'CLINIC'] },
        kind: { type: 'string', enum: ['CRMV', 'IDENTITY', 'CLINIC_LICENSE', 'OTHER'] },
        clinicId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({ summary: 'Envia documento privado (PDF, JPEG ou PNG até 10 MB)' })
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES.document, files: 1 } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.verification.uploadDocument(user.id, dto, file);
  }

  @Get('documents')
  documents(@CurrentUser() user: AuthenticatedUser, @Query() query: DocumentScopeQuery) {
    return this.verification.listDocuments(user.id, query);
  }

  @Delete('documents/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.verification.deleteDocument(user.id, id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Envia o perfil completo para análise (solicitação nasce PENDING)' })
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitVerificationDto) {
    return this.verification.submit(user.id, dto);
  }

  @Get('requests/mine')
  @ApiOperation({ summary: 'Situação das minhas solicitações, com o motivo quando houver correção' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.verification.listMine(user.id);
  }
}
