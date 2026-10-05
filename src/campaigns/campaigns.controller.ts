import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PaginationQuery } from '../common/dto/pagination.dto';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, ListCampaignsAdminQuery, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Campanhas')
@Controller('campaigns')
export class CampaignsPublicController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Campanhas publicadas, verificadas e dentro do período' })
  list(@Query() query: PaginationQuery) {
    return this.campaigns.listPublic(query);
  }

  @Get(':id')
  get(@Param('id', ParseIdPipe) id: string) {
    return this.campaigns.getPublic(id);
  }
}

@ApiTags('Campanhas (admin)')
@Controller('admin/campaigns')
@Protected('ADMIN')
export class CampaignsAdminController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria campanha em rascunho. `warnings` avisa de possível duplicidade.' })
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(admin.id, dto);
  }

  @Get()
  list(@Query() query: ListCampaignsAdminQuery) {
    return this.campaigns.listAdmin(query);
  }

  @Get(':id')
  get(@Param('id', ParseIdPipe) id: string) {
    return this.campaigns.getAdmin(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(admin.id, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.campaigns.submitForReview(admin.id, id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publica campanha em revisão, registrando quem verificou e quando' })
  publish(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.campaigns.publish(admin.id, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.campaigns.archive(admin.id, id);
  }
}
