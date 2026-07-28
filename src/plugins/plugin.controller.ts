import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PluginRegistryService } from './plugin-registry.service';

@ApiTags('Plugins')
@Controller('plugins')
export class PluginController {
  constructor(private readonly pluginRegistry: PluginRegistryService) {}

  @Get()
  listPlugins() {
    return this.pluginRegistry.listPlugins();
  }
}
