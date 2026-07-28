import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GitCollectorService } from './git-collector.service';

@ApiTags('Git Collector')
@Controller('git-collector')
export class GitCollectorController {
  constructor(private readonly gitCollectorService: GitCollectorService) {}

  @Post(':connectorId/sync')
  sync(@Param('connectorId') connectorId: string) {
    return this.gitCollectorService.sync(connectorId);
  }
}
