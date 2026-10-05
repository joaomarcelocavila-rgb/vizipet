import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { LocalStorageService } from './local-storage.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: StorageService,
      inject: [AppConfig],
      useFactory: (config: AppConfig): StorageService =>
        config.get('STORAGE_DRIVER') === 'supabase'
          ? new SupabaseStorageService(config)
          : new LocalStorageService(config),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
