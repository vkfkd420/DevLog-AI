import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CorrelationService } from './correlation.service';

@ApiTags('Correlation')
@Controller('correlation')
export class CorrelationController {
  constructor(private readonly correlationService: CorrelationService) {}

  @Post(':projectId/compute')
  compute(@Param('projectId') projectId: string) {
    return this.correlationService.computeForProject(projectId);
  }

  @Get(':projectId/sessions')
  listSessions(@Param('projectId') projectId: string) {
    return this.correlationService.listSessions(projectId);
  }
}
