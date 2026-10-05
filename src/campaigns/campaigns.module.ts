import { Module } from '@nestjs/common';
import { CampaignsAdminController, CampaignsPublicController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  controllers: [CampaignsPublicController, CampaignsAdminController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
