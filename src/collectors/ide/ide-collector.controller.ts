import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdeCollectorService } from './ide-collector.service';
import { ReportIdeActivityDto } from './dto/report-ide-activity.dto';

@ApiTags('IDE Collector')
@Controller('ide-collector')
export class IdeCollectorController {
  constructor(private readonly ideCollectorService: IdeCollectorService) {}

  @Post(':connectorId/activity')
  reportActivity(@Param('connectorId') connectorId: string, @Body() dto: ReportIdeActivityDto) {
    return this.ideCollectorService.reportActivity(connectorId, dto);
  }

  @Post(':connectorId/flush')
  flush(@Param('connectorId') connectorId: string) {
    return this.ideCollectorService.flush(connectorId);
  }
}
