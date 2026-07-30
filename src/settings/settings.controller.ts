import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SettingsService, UpdateAutoDraftSettingDto } from './settings.service';

@ApiTags('Settings')
@Controller('settings/auto-draft')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdateAutoDraftSettingDto) {
    return this.settingsService.update(dto);
  }
}
