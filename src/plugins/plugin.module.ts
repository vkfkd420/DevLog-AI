import { Module } from '@nestjs/common';
import { PluginController } from './plugin.controller';
import { PluginRegistryService } from './plugin-registry.service';

@Module({
  controllers: [PluginController],
  providers: [PluginRegistryService],
})
export class PluginModule {}
